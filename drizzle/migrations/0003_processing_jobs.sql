CREATE TABLE public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  adapter text,
  adapter_version text,
  error text,
  result jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, idempotency_key)
);
CREATE INDEX ON public.processing_jobs(org_id, status, created_at DESC);
CREATE INDEX ON public.processing_jobs(asset_id);
GRANT SELECT, INSERT, UPDATE ON public.processing_jobs TO authenticated;
GRANT ALL ON public.processing_jobs TO service_role;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY processing_jobs_read ON public.processing_jobs FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY processing_jobs_insert ON public.processing_jobs FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id, 'contributor'));
CREATE POLICY processing_jobs_update ON public.processing_jobs FOR UPDATE TO authenticated USING (public.is_org_member(org_id, 'contributor'));
CREATE TRIGGER t8 BEFORE UPDATE ON public.processing_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
