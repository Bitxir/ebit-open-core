CREATE OR REPLACE FUNCTION public.complete_ai_job(_job uuid,_output jsonb,_model text,_version text,_confidence double precision,_latency int,_run text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.ai_jobs; iid uuid; a jsonb;
BEGIN
 SELECT * INTO j FROM public.ai_jobs WHERE id=_job FOR UPDATE;
 IF j.id IS NULL OR j.status<>'running' THEN RAISE EXCEPTION 'Job is not running'; END IF;
 INSERT INTO public.interpretations(org_id,job_id,asset_id,task,provider,model,model_version,confidence,latency_ms,run_id,output) VALUES(j.org_id,j.id,j.asset_id,j.task,'lovable-ai',_model,NULLIF(_version,''),NULLIF(_confidence,-1),_latency,NULLIF(_run,''),_output) RETURNING id INTO iid;
 FOR a IN SELECT value FROM jsonb_array_elements(COALESCE(_output->'annotations','[]')) LOOP
 INSERT INTO public.annotations(org_id,interpretation_id,label,value) VALUES(j.org_id,iid,a->>'label',a->>'value'); END LOOP;
 UPDATE public.ai_jobs SET status='succeeded',finished_at=now(),error=NULL WHERE id=j.id;
 INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,software,actor_id,details) VALUES(j.org_id,'interpretation',iid,'ai_interpreted','ai',_model,j.consent_by,jsonb_build_object('asset_id',j.asset_id,'job_id',j.id,'run_id',NULLIF(_run,'')));
 RETURN iid;
END $$;
REVOKE ALL ON FUNCTION public.complete_ai_job(uuid,jsonb,text,text,double precision,int,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.complete_ai_job(uuid,jsonb,text,text,double precision,int,text) TO service_role;