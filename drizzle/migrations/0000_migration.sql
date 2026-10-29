-- EBiT Open Core: Phase 1 foundation
CREATE TYPE public.org_role AS ENUM ('admin','curator','contributor','viewer');
CREATE TYPE public.rights_state AS ENUM ('unknown','under_review','permitted_processing','permitted_redistribution','restricted');
CREATE TYPE public.entity_kind AS ENUM ('object','asset','observation','dataset','interpretation','annotation');

CREATE OR REPLACE FUNCTION public.ebit_id(prefix text) RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT prefix || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('ORG'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.organization_members (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX ON public.organization_members(user_id);
GRANT SELECT ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _min public.org_role DEFAULT 'viewer')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
      AND array_position(ARRAY['viewer','contributor','curator','admin']::text[], m.role::text)
          >= array_position(ARRAY['viewer','contributor','curator','admin']::text[], _min::text)
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, public.org_role) TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY orgs_read ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY orgs_update ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_member(id,'admin'));
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));

-- New user -> profile + personal workspace as admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  INSERT INTO public.profiles(id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.organizations(name, created_by) VALUES (COALESCE(split_part(NEW.email,'@',1),'My') || ' workspace', NEW.id) RETURNING id INTO _org;
  INSERT INTO public.organization_members(org_id, user_id, role) VALUES (_org, NEW.id, 'admin');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rights records
CREATE TABLE public.rights_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  state public.rights_state NOT NULL DEFAULT 'unknown',
  license text,
  attribution text,
  source text,
  permitted_uses text[] NOT NULL DEFAULT '{}',
  restrictions text,
  ai_training_allowed boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Objects
CREATE TABLE public.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('OBJ'),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.objects(id) ON DELETE SET NULL,
  object_type text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  description text,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  domain text,
  rights_id uuid REFERENCES public.rights_records(id),
  metadata jsonb NOT NULL DEFAULT '{}',
  original_metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.objects(org_id, object_type);
CREATE INDEX ON public.objects(latitude, longitude);

-- Assets (originals preserved; never overwritten)
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('AST'),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  mime_type text,
  file_name text,
  byte_size bigint CHECK (byte_size >= 0),
  sha256 text CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text,
  source text,
  source_identifier text,
  captured_at timestamptz,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  device text,
  ingestion_status text NOT NULL DEFAULT 'received',
  adapter text,
  adapter_version text,
  rights_id uuid REFERENCES public.rights_records(id),
  metadata jsonb NOT NULL DEFAULT '{}',
  original_metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assets_org_sha_unique ON public.assets(org_id, sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX ON public.assets(org_id, kind, created_at DESC);

CREATE TABLE public.asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version int NOT NULL,
  is_original boolean NOT NULL DEFAULT false,
  derivation text,
  storage_path text,
  sha256 text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, version)
);

-- Observations
CREATE TABLE public.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('OBS'),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  object_id uuid REFERENCES public.objects(id) ON DELETE SET NULL,
  observation_type text NOT NULL,
  domain text,
  observed_at timestamptz,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  value_numeric double precision,
  value_text text,
  unit text,
  source text,
  verification_status text NOT NULL DEFAULT 'unverified',
  rights_id uuid REFERENCES public.rights_records(id),
  metadata jsonb NOT NULL DEFAULT '{}',
  original_metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.observations(org_id, observation_type, observed_at DESC);
CREATE INDEX ON public.observations(latitude, longitude);

-- Datasets
CREATE TABLE public.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('DST'),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description text,
  rights_id uuid REFERENCES public.rights_records(id),
  published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dataset_items (
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_kind public.entity_kind NOT NULL,
  entity_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset_id, entity_kind, entity_id)
);

-- Relationships (identity graph)
CREATE TABLE public.relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_kind public.entity_kind NOT NULL,
  from_id uuid NOT NULL,
  rel_type text NOT NULL,
  to_kind public.entity_kind NOT NULL,
  to_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_kind, from_id, rel_type, to_kind, to_id),
  CHECK (NOT (from_kind = to_kind AND from_id = to_id))
);
CREATE INDEX ON public.relationships(from_kind, from_id);
CREATE INDEX ON public.relationships(to_kind, to_id);

-- Provenance (append-only)
CREATE TABLE public.provenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_kind public.entity_kind NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  agent text NOT NULL,
  software text,
  software_version text,
  inputs jsonb NOT NULL DEFAULT '[]',
  outputs jsonb NOT NULL DEFAULT '[]',
  details jsonb NOT NULL DEFAULT '{}',
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.provenance_events(entity_kind, entity_id, occurred_at);

-- Audit log (append-only)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_log(org_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER provenance_append_only BEFORE UPDATE OR DELETE ON public.provenance_events FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

-- Original asset versions are immutable
CREATE OR REPLACE FUNCTION public.protect_original_version() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF OLD.is_original THEN RAISE EXCEPTION 'original asset versions cannot be changed or deleted'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER asset_versions_protect BEFORE UPDATE OR DELETE ON public.asset_versions FOR EACH ROW EXECUTE FUNCTION public.protect_original_version();

-- Datasets can only be published when rights allow redistribution
CREATE OR REPLACE FUNCTION public.guard_dataset_publish() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.published AND NOT EXISTS (SELECT 1 FROM public.rights_records r WHERE r.id = NEW.rights_id AND r.state = 'permitted_redistribution') THEN
    RAISE EXCEPTION 'dataset cannot be published: rights must permit redistribution';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER datasets_publish_guard BEFORE INSERT OR UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.guard_dataset_publish();

-- updated_at triggers
CREATE TRIGGER t1 BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t2 BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t3 BEFORE UPDATE ON public.rights_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t4 BEFORE UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t5 BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t6 BEFORE UPDATE ON public.observations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t7 BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Grants + RLS for org-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rights_records','objects','assets','asset_versions','observations','datasets','dataset_items','relationships'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(org_id))', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id, ''contributor''))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_org_member(org_id, ''contributor''))', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_org_member(org_id, ''curator''))', t||'_delete', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['provenance_events','audit_log'] LOOP
    EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(org_id))', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id, ''contributor''))', t||'_insert', t);
  END LOOP;
END $$;
