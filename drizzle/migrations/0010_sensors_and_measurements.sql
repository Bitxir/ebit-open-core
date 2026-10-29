CREATE TABLE public.sensors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('SEN'), org_id uuid NOT NULL REFERENCES public.organizations(id), object_id uuid REFERENCES public.objects(id), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200), description text, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
GRANT SELECT ON public.sensors TO authenticated; GRANT ALL ON public.sensors TO service_role;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
CREATE POLICY sensors_read ON public.sensors FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TABLE public.datastreams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('STR'), org_id uuid NOT NULL REFERENCES public.organizations(id), sensor_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200), observed_property text NOT NULL CHECK(length(observed_property) BETWEEN 1 AND 200), unit text NOT NULL CHECK(length(unit) BETWEEN 1 AND 100), rights_id uuid NOT NULL REFERENCES public.rights_records(id), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id), FOREIGN KEY(org_id,sensor_id) REFERENCES public.sensors(org_id,id)
);
GRANT SELECT ON public.datastreams TO authenticated; GRANT ALL ON public.datastreams TO service_role;
ALTER TABLE public.datastreams ENABLE ROW LEVEL SECURITY;
CREATE POLICY datastreams_read ON public.datastreams FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TABLE public.measurements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id), datastream_id uuid NOT NULL, observed_at timestamptz NOT NULL, value double precision NOT NULL CHECK(value NOT IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8)), source_asset_id uuid REFERENCES public.assets(id), source_row int, source text NOT NULL CHECK(source IN ('file','device')), original_metadata jsonb NOT NULL, verification_status text NOT NULL DEFAULT 'unverified' CHECK(verification_status='unverified'), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(org_id,datastream_id) REFERENCES public.datastreams(org_id,id), UNIQUE(datastream_id,observed_at)
);
GRANT SELECT ON public.measurements TO authenticated; GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY measurements_read ON public.measurements FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TRIGGER measurements_append_only BEFORE UPDATE OR DELETE ON public.measurements FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE INDEX ON public.measurements(datastream_id,observed_at DESC);
CREATE TABLE public.sensor_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id), datastream_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), key_hash text NOT NULL UNIQUE CHECK(key_hash ~ '^[a-f0-9]{64}$'), key_prefix text NOT NULL, created_by uuid NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(org_id,datastream_id) REFERENCES public.datastreams(org_id,id)
);
GRANT SELECT(id,org_id,datastream_id,name,key_prefix,created_by,revoked_at,created_at) ON public.sensor_keys TO authenticated; GRANT ALL ON public.sensor_keys TO service_role;
ALTER TABLE public.sensor_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY sensor_keys_read ON public.sensor_keys FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.sensors,public.datastreams,public.measurements,public.sensor_keys FROM anon,authenticated;
REVOKE SELECT ON public.sensor_keys FROM authenticated,anon;
GRANT SELECT(id,org_id,datastream_id,name,key_prefix,created_by,revoked_at,created_at) ON public.sensor_keys TO authenticated;
CREATE OR REPLACE FUNCTION public.register_sensor(_org uuid,_name text,_description text,_object uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 IF NOT public.is_org_member(_org,'contributor') THEN RAISE EXCEPTION 'Contributor access required'; END IF;
 IF _object IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.objects WHERE id=_object AND org_id=_org) THEN RAISE EXCEPTION 'Object must belong to workspace'; END IF;
 IF length(trim(_name)) NOT BETWEEN 1 AND 200 OR length(COALESCE(_description,''))>2000 THEN RAISE EXCEPTION 'Invalid sensor'; END IF;
 INSERT INTO public.sensors(org_id,name,description,object_id,created_by) VALUES(_org,trim(_name),_description,_object,auth.uid()) RETURNING id INTO sid;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id) VALUES(_org,auth.uid(),'register_sensor','sensors',sid);
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.register_sensor(uuid,text,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.register_sensor(uuid,text,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.register_datastream(_sensor uuid,_name text,_property text,_unit text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sensors; rid uuid; streamid uuid;
BEGIN
 SELECT * INTO s FROM public.sensors WHERE id=_sensor;
 IF s.id IS NULL OR NOT public.is_org_member(s.org_id,'contributor') THEN RAISE EXCEPTION 'Contributor access required'; END IF;
 IF length(trim(_name)) NOT BETWEEN 1 AND 200 OR length(trim(_property)) NOT BETWEEN 1 AND 200 OR length(trim(_unit)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid stream'; END IF;
 INSERT INTO public.rights_records(org_id,created_by) VALUES(s.org_id,auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.datastreams(org_id,sensor_id,name,observed_property,unit,rights_id,created_by) VALUES(s.org_id,s.id,trim(_name),trim(_property),trim(_unit),rid,auth.uid()) RETURNING id INTO streamid;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id) VALUES(s.org_id,auth.uid(),'register_datastream','datastreams',streamid);
 RETURN streamid;
END $$;
REVOKE ALL ON FUNCTION public.register_datastream(uuid,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.register_datastream(uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.issue_sensor_key(_stream uuid,_name text,_hash text,_prefix text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.datastreams; kid uuid;
BEGIN
 SELECT * INTO s FROM public.datastreams WHERE id=_stream;
 IF s.id IS NULL OR NOT public.is_org_member(s.org_id,'curator') THEN RAISE EXCEPTION 'Curator access required'; END IF;
 IF length(trim(_name)) NOT BETWEEN 1 AND 100 OR _hash !~ '^[a-f0-9]{64}$' OR length(_prefix)>24 THEN RAISE EXCEPTION 'Invalid key'; END IF;
 INSERT INTO public.sensor_keys(org_id,datastream_id,name,key_hash,key_prefix,created_by) VALUES(s.org_id,s.id,trim(_name),_hash,_prefix,auth.uid()) RETURNING id INTO kid;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id) VALUES(s.org_id,auth.uid(),'issue_sensor_key','sensor_keys',kid);
 RETURN kid;
END $$;
REVOKE ALL ON FUNCTION public.issue_sensor_key(uuid,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.issue_sensor_key(uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.revoke_sensor_key(_key uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k public.sensor_keys;
BEGIN
 SELECT * INTO k FROM public.sensor_keys WHERE id=_key FOR UPDATE;
 IF k.id IS NULL OR NOT public.is_org_member(k.org_id,'curator') THEN RAISE EXCEPTION 'Curator access required'; END IF;
 UPDATE public.sensor_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE id=k.id;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id) VALUES(k.org_id,auth.uid(),'revoke_sensor_key','sensor_keys',k.id);
END $$;
REVOKE ALL ON FUNCTION public.revoke_sensor_key(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.revoke_sensor_key(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.write_sensor_batch(_stream uuid,_rows jsonb,_asset uuid,_actor uuid,_source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.datastreams; rowdata jsonb; tm timestamptz; val double precision; added int:=0; skipped int:=0; mid uuid; n int:=0;
BEGIN
 SELECT * INTO s FROM public.datastreams WHERE id=_stream FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid stream'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 1000 OR _source NOT IN ('file','device') THEN RAISE EXCEPTION 'Invalid batch'; END IF;
 IF _asset IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assets WHERE id=_asset AND org_id=s.org_id AND ingestion_status='ready' AND adapter='sensor-timeseries') THEN RAISE EXCEPTION 'Invalid original'; END IF;
 FOR rowdata IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 n:=n+1;
 IF jsonb_typeof(rowdata->'value')<>'number' OR (rowdata->>'timestamp') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' OR jsonb_typeof(rowdata->'original')<>'object' THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
 tm:=(rowdata->>'timestamp')::timestamptz; val:=(rowdata->>'value')::float8;
 IF EXISTS(SELECT 1 FROM public.measurements WHERE datastream_id=s.id AND observed_at=tm AND value<>val) THEN RAISE EXCEPTION 'Conflicting value at existing timestamp'; END IF;
 INSERT INTO public.measurements(org_id,datastream_id,observed_at,value,source_asset_id,source_row,source,original_metadata) VALUES(s.org_id,s.id,tm,val,_asset,CASE WHEN _asset IS NULL THEN NULL ELSE n END,_source,rowdata->'original') ON CONFLICT(datastream_id,observed_at) DO NOTHING RETURNING id INTO mid;
 IF mid IS NULL THEN skipped:=skipped+1; ELSE added:=added+1; END IF;
 END LOOP;
 IF added>0 THEN
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id,details) VALUES(s.org_id,_actor,'sensor_measurements_imported','datastreams',s.id,jsonb_build_object('added',added,'source',_source,'asset_id',_asset));
 IF s.sensor_id IS NOT NULL THEN
 INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,actor_id,details) VALUES(s.org_id,'observation',s.id,'sensor_measurements_imported',_source,_actor,jsonb_build_object('datastream_id',s.id,'added',added,'asset_id',_asset));
 END IF; END IF;
 RETURN jsonb_build_object('added',added,'skipped',skipped);
END $$;
REVOKE ALL ON FUNCTION public.write_sensor_batch(uuid,jsonb,uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.write_sensor_batch(uuid,jsonb,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.import_sensor_measurements(_stream uuid,_asset uuid,_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.datastreams;
BEGIN
 SELECT * INTO s FROM public.datastreams WHERE id=_stream;
 IF s.id IS NULL OR NOT public.is_org_member(s.org_id,'curator') THEN RAISE EXCEPTION 'Curator access required'; END IF;
 IF _asset IS NULL THEN RAISE EXCEPTION 'Original asset required'; END IF;
 RETURN public.write_sensor_batch(_stream,_rows,_asset,auth.uid(),'file');
END $$;
REVOKE ALL ON FUNCTION public.import_sensor_measurements(uuid,uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.import_sensor_measurements(uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.ingest_sensor_key(_hash text,_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k public.sensor_keys;
BEGIN
 SELECT * INTO k FROM public.sensor_keys WHERE key_hash=_hash AND revoked_at IS NULL FOR SHARE;
 IF k.id IS NULL THEN RAISE EXCEPTION 'Invalid device key' USING ERRCODE='28000'; END IF;
 RETURN public.write_sensor_batch(k.datastream_id,_rows,NULL,k.created_by,'device');
END $$;
REVOKE ALL ON FUNCTION public.ingest_sensor_key(text,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.ingest_sensor_key(text,jsonb) TO service_role;