CREATE TABLE public.ai_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id), asset_id uuid NOT NULL REFERENCES public.assets(id), task text NOT NULL CHECK(task IN ('image_description','species_suggestion','document_extraction')), status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','paused')), attempts int NOT NULL DEFAULT 0, max_attempts int NOT NULL DEFAULT 3, retry_at timestamptz, error text, error_status int, consent_by uuid NOT NULL, consent_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, UNIQUE(org_id,asset_id,task)
);
GRANT SELECT ON public.ai_jobs TO authenticated; GRANT ALL ON public.ai_jobs TO service_role;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_jobs_read ON public.ai_jobs FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));
CREATE TABLE public.interpretations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ebit_id text NOT NULL UNIQUE DEFAULT public.ebit_id('INT'), org_id uuid NOT NULL REFERENCES public.organizations(id), job_id uuid NOT NULL UNIQUE REFERENCES public.ai_jobs(id), asset_id uuid NOT NULL REFERENCES public.assets(id), task text NOT NULL, provider text NOT NULL, model text NOT NULL, model_version text, confidence double precision CHECK(confidence BETWEEN 0 AND 1), latency_ms int NOT NULL, run_id text, output jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interpretations TO authenticated; GRANT ALL ON public.interpretations TO service_role;
ALTER TABLE public.interpretations ENABLE ROW LEVEL SECURITY;
CREATE POLICY interpretations_read ON public.interpretations FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));
CREATE TRIGGER interpretations_immutable BEFORE UPDATE OR DELETE ON public.interpretations FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TABLE public.annotations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id), interpretation_id uuid NOT NULL REFERENCES public.interpretations(id), label text NOT NULL, value text, origin text NOT NULL DEFAULT 'ai' CHECK(origin='ai'), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.annotations TO authenticated; GRANT ALL ON public.annotations TO service_role;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY annotations_read ON public.annotations FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));
CREATE TRIGGER annotations_immutable BEFORE UPDATE OR DELETE ON public.annotations FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TABLE public.verification_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id), interpretation_id uuid NOT NULL REFERENCES public.interpretations(id), decision text NOT NULL CHECK(decision IN ('verified','rejected','needs_review')), evidence text NOT NULL CHECK(char_length(evidence) BETWEEN 1 AND 4000), reviewer_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verification_events TO authenticated; GRANT ALL ON public.verification_events TO service_role;
ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_read ON public.verification_events FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));
CREATE TRIGGER verification_immutable BEFORE UPDATE OR DELETE ON public.verification_events FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();
CREATE TABLE public.ai_controls (
 org_id uuid PRIMARY KEY REFERENCES public.organizations(id), paused boolean NOT NULL DEFAULT false, reason text, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_controls TO authenticated; GRANT ALL ON public.ai_controls TO service_role;
ALTER TABLE public.ai_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_controls_read ON public.ai_controls FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));
CREATE OR REPLACE FUNCTION public.review_interpretation(_id uuid,_decision text,_evidence text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.interpretations; event_id uuid;
BEGIN
 SELECT * INTO i FROM public.interpretations WHERE id=_id;
 IF i.id IS NULL OR NOT public.is_org_member(i.org_id,'curator') THEN RAISE EXCEPTION 'Curator access required'; END IF;
 IF _decision NOT IN ('verified','rejected','needs_review') OR length(trim(_evidence)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Decision and evidence required'; END IF;
 INSERT INTO public.verification_events(org_id,interpretation_id,decision,evidence,reviewer_id) VALUES(i.org_id,i.id,_decision,trim(_evidence),auth.uid()) RETURNING id INTO event_id;
 INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,actor_id,details) VALUES(i.org_id,'interpretation',i.id,'human_review','user',auth.uid(),jsonb_build_object('decision',_decision,'event_id',event_id));
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id,details) VALUES(i.org_id,auth.uid(),'review_interpretation','interpretations',i.id,jsonb_build_object('decision',_decision,'event_id',event_id));
 RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.review_interpretation(uuid,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.review_interpretation(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.complete_ai_job(_job uuid,_output jsonb,_model text,_version text,_confidence double precision,_latency int,_run text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.ai_jobs; iid uuid; a jsonb;
BEGIN
 SELECT * INTO j FROM public.ai_jobs WHERE id=_job FOR UPDATE;
 IF j.id IS NULL OR j.status<>'running' THEN RAISE EXCEPTION 'Job is not running'; END IF;
 INSERT INTO public.interpretations(org_id,job_id,asset_id,task,provider,model,model_version,confidence,latency_ms,run_id,output) VALUES(j.org_id,j.id,j.asset_id,j.task,'lovable-ai',_model,_version,_confidence,_latency,_run,_output) RETURNING id INTO iid;
 FOR a IN SELECT value FROM jsonb_array_elements(COALESCE(_output->'annotations','[]')) LOOP
 INSERT INTO public.annotations(org_id,interpretation_id,label,value) VALUES(j.org_id,iid,a->>'label',a->>'value'); END LOOP;
 UPDATE public.ai_jobs SET status='succeeded',finished_at=now(),error=NULL WHERE id=j.id;
 INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,software,actor_id,details) VALUES(j.org_id,'interpretation',iid,'ai_interpreted','ai',_model,j.consent_by,jsonb_build_object('asset_id',j.asset_id,'job_id',j.id,'run_id',_run));
 RETURN iid;
END $$;
REVOKE ALL ON FUNCTION public.complete_ai_job(uuid,jsonb,text,text,double precision,int,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.complete_ai_job(uuid,jsonb,text,text,double precision,int,text) TO service_role;
CREATE INDEX ON public.ai_jobs(org_id,status,retry_at); CREATE INDEX ON public.verification_events(interpretation_id,created_at DESC);