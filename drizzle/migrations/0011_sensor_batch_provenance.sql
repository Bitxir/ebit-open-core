CREATE OR REPLACE FUNCTION public.write_sensor_batch(_stream uuid,_rows jsonb,_asset uuid,_actor uuid,_source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.datastreams; rowdata jsonb; tm timestamptz; val double precision; added int:=0; skipped int:=0; mid uuid; n int:=0; obj uuid;
BEGIN
 SELECT * INTO s FROM public.datastreams WHERE id=_stream FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Invalid stream'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 1000 OR _source NOT IN ('file','device') THEN RAISE EXCEPTION 'Invalid batch'; END IF;
 IF _asset IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assets WHERE id=_asset AND org_id=s.org_id AND ingestion_status='ready' AND adapter='sensor-timeseries') THEN RAISE EXCEPTION 'Invalid original'; END IF;
 FOR rowdata IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 n:=n+1;
 IF jsonb_typeof(rowdata->'value') IS DISTINCT FROM 'number' OR (rowdata->>'timestamp') IS NULL OR (rowdata->>'timestamp') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' OR jsonb_typeof(rowdata->'original') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
 tm:=(rowdata->>'timestamp')::timestamptz; val:=(rowdata->>'value')::float8;
 IF EXISTS(SELECT 1 FROM public.measurements WHERE datastream_id=s.id AND observed_at=tm AND value<>val) THEN RAISE EXCEPTION 'Conflicting value at existing timestamp'; END IF;
 mid:=NULL;
 INSERT INTO public.measurements(org_id,datastream_id,observed_at,value,source_asset_id,source_row,source,original_metadata) VALUES(s.org_id,s.id,tm,val,_asset,CASE WHEN _asset IS NULL THEN NULL ELSE n END,_source,rowdata->'original') ON CONFLICT(datastream_id,observed_at) DO NOTHING RETURNING id INTO mid;
 IF mid IS NULL THEN skipped:=skipped+1; ELSE added:=added+1; END IF;
 END LOOP;
 IF added>0 THEN
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id,details) VALUES(s.org_id,_actor,'sensor_measurements_imported','datastreams',s.id,jsonb_build_object('added',added,'source',_source,'asset_id',_asset));
 SELECT object_id INTO obj FROM public.sensors WHERE id=s.sensor_id;
 IF _asset IS NOT NULL THEN
 INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,actor_id,details) VALUES(s.org_id,'asset',_asset,'sensor_measurements_imported',_source,_actor,jsonb_build_object('datastream_id',s.id,'added',added));
 ELSIF obj IS NOT NULL THEN
 INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,actor_id,details) VALUES(s.org_id,'object',obj,'sensor_measurements_imported',_source,_actor,jsonb_build_object('datastream_id',s.id,'added',added));
 END IF; END IF;
 RETURN jsonb_build_object('added',added,'skipped',skipped);
END $$;
REVOKE ALL ON FUNCTION public.write_sensor_batch(uuid,jsonb,uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.write_sensor_batch(uuid,jsonb,uuid,uuid,text) TO service_role;