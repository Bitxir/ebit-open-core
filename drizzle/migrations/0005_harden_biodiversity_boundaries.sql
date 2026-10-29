-- Explicitly revoke default write privileges as well as relying on read-only RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.taxa, public.biodiversity_observations, public.biodiversity_details FROM authenticated, anon;
CREATE OR REPLACE FUNCTION public.guard_sensitive_occurrence() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.sensitive THEN NEW.occurrence_id := 'OCC-' || md5(NEW.org_id::text || ':' || NEW.occurrence_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER biodiversity_sensitive_id BEFORE INSERT ON public.biodiversity_observations FOR EACH ROW EXECUTE FUNCTION public.guard_sensitive_occurrence();
-- Existing graph edits must not change the safe coordinate or metadata representation.
CREATE OR REPLACE FUNCTION public.guard_biodiversity_observation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.biodiversity_observations WHERE id=OLD.id) AND (NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude OR NEW.metadata IS DISTINCT FROM OLD.metadata OR NEW.original_metadata IS DISTINCT FROM OLD.original_metadata OR NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
  RAISE EXCEPTION 'Biodiversity location and original metadata are protected';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER biodiversity_observation_guard BEFORE UPDATE ON public.observations FOR EACH ROW EXECUTE FUNCTION public.guard_biodiversity_observation();