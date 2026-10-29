-- Tabular originals may contain precise sensitive locations. Curators/admins only, including existing files.
CREATE POLICY tabular_assets_read ON public.assets AS RESTRICTIVE FOR SELECT TO authenticated USING (file_name IS NULL OR file_name !~* '\.(csv|tsv)$' OR public.is_org_member(org_id,'curator'));
CREATE POLICY tabular_assets_write ON public.assets AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (file_name IS NULL OR file_name !~* '\.(csv|tsv)$' OR public.is_org_member(org_id,'curator'));
CREATE POLICY tabular_originals_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id <> 'originals' OR name !~* '\.(csv|tsv)$' OR public.is_org_member(((storage.foldername(name))[1])::uuid,'curator'));
CREATE POLICY tabular_originals_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'originals' OR name !~* '\.(csv|tsv)$' OR public.is_org_member(((storage.foldername(name))[1])::uuid,'curator'));
CREATE POLICY tabular_versions_read ON public.asset_versions AS RESTRICTIVE FOR SELECT TO authenticated USING (storage_path IS NULL OR storage_path !~* '\.(csv|tsv)$' OR public.is_org_member(org_id,'curator'));

CREATE TABLE public.taxa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id),
 scientific_name text NOT NULL CHECK (length(scientific_name) BETWEEN 1 AND 300),
 kingdom text, family text, genus text, taxon_rank text,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(org_id,scientific_name), UNIQUE(org_id,id)
);
GRANT SELECT ON public.taxa TO authenticated;
GRANT ALL ON public.taxa TO service_role;
ALTER TABLE public.taxa ENABLE ROW LEVEL SECURITY;
CREATE POLICY taxa_read ON public.taxa FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.biodiversity_observations (
 id uuid PRIMARY KEY REFERENCES public.observations(id), org_id uuid NOT NULL REFERENCES public.organizations(id),
 taxon_id uuid NOT NULL, occurrence_id text NOT NULL, event_date text, basis_of_record text CHECK (basis_of_record IN ('HumanObservation','MachineObservation','PreservedSpecimen','LivingSpecimen','FossilSpecimen','MaterialSample','MaterialCitation','Occurrence')),
 latitude double precision CHECK(latitude BETWEEN -90 AND 90), longitude double precision CHECK(longitude BETWEEN -180 AND 180),
 coordinate_uncertainty double precision CHECK(coordinate_uncertainty >= 0), sensitive boolean NOT NULL DEFAULT false,
 habitat text, source_asset_id uuid REFERENCES public.assets(id), source_row integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,taxon_id) REFERENCES public.taxa(org_id,id),
 UNIQUE(org_id,occurrence_id), UNIQUE(source_asset_id,source_row), UNIQUE(org_id,id),
 CHECK ((latitude IS NULL) = (longitude IS NULL))
);
GRANT SELECT ON public.biodiversity_observations TO authenticated;
GRANT ALL ON public.biodiversity_observations TO service_role;
ALTER TABLE public.biodiversity_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY biodiversity_read ON public.biodiversity_observations FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE INDEX biodiversity_geo ON public.biodiversity_observations(org_id,latitude,longitude);
CREATE INDEX biodiversity_date ON public.biodiversity_observations(org_id,event_date);

CREATE TABLE public.biodiversity_details (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, latitude double precision CHECK(latitude BETWEEN -90 AND 90), longitude double precision CHECK(longitude BETWEEN -180 AND 180),
 locality text, recorded_by text, original_metadata jsonb NOT NULL DEFAULT '{}',
 FOREIGN KEY(org_id,id) REFERENCES public.biodiversity_observations(org_id,id)
);
GRANT SELECT ON public.biodiversity_details TO authenticated;
GRANT ALL ON public.biodiversity_details TO service_role;
ALTER TABLE public.biodiversity_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY biodiversity_details_read ON public.biodiversity_details FOR SELECT TO authenticated USING(public.is_org_member(org_id,'curator'));

-- Atomic explicit import, replay-safe by source row and occurrence ID. No caller-controlled role or actor.
CREATE OR REPLACE FUNCTION public.import_biodiversity(_org uuid, _rows jsonb, _asset uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; tid uuid; oid uuid; rid uuid; eid text; occ text; lat double precision; lng double precision; sens boolean; idx integer := 0; added integer := 0; skipped integer := 0;
BEGIN
 IF NOT public.is_org_member(_org,'contributor') THEN RAISE EXCEPTION 'Contributor access required'; END IF;
 IF _asset IS NOT NULL AND (NOT public.is_org_member(_org,'curator') OR NOT EXISTS (SELECT 1 FROM public.assets WHERE id=_asset AND org_id=_org AND adapter='darwin-core' AND ingestion_status='ready')) THEN RAISE EXCEPTION 'Curator access and a processed Darwin Core original required'; END IF;
 IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION '1 to 500 rows required'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  idx := idx + 1;
  IF coalesce(length(trim(r->>'scientificName')),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Scientific name required'; END IF;
  occ := coalesce(nullif(r->>'occurrenceID',''), CASE WHEN _asset IS NOT NULL THEN _asset::text || ':' || idx::text ELSE public.ebit_id('OCC') END);
  IF EXISTS(SELECT 1 FROM public.biodiversity_observations WHERE org_id=_org AND (occurrence_id=occ OR (source_asset_id=_asset AND source_row=idx))) THEN skipped := skipped+1; CONTINUE; END IF;
  INSERT INTO public.taxa(org_id,scientific_name,kingdom,family,genus,taxon_rank,created_by) VALUES(_org,r->>'scientificName',r->>'kingdom',r->>'family',r->>'genus',r->>'taxonRank',auth.uid()) ON CONFLICT(org_id,scientific_name) DO NOTHING;
  SELECT id INTO tid FROM public.taxa WHERE org_id=_org AND scientific_name=r->>'scientificName';
  sens := coalesce((r->>'sensitive')::boolean,false); lat := (r->>'decimalLatitude')::double precision; lng := (r->>'decimalLongitude')::double precision;
  INSERT INTO public.rights_records(org_id,state,license,attribution,source,created_by) SELECT _org,coalesce(rr.state,'unknown'::public.rights_state),rr.license,rr.attribution,rr.source,auth.uid() FROM (SELECT 1) dummy LEFT JOIN public.assets a ON a.id=_asset LEFT JOIN public.rights_records rr ON rr.id=a.rights_id RETURNING id INTO rid;
  INSERT INTO public.observations(org_id,observation_type,domain,value_text,latitude,longitude,source,rights_id,created_by) VALUES(_org,'occurrence','biodiversity',r->>'scientificName', CASE WHEN sens THEN least(89.95,floor(lat*10)/10+0.05) ELSE lat END,CASE WHEN sens THEN least(179.95,floor(lng*10)/10+0.05) ELSE lng END,CASE WHEN _asset IS NULL THEN 'manual' ELSE 'darwin-core' END,rid,auth.uid()) RETURNING id,ebit_id INTO oid,eid;
  INSERT INTO public.biodiversity_observations(id,org_id,taxon_id,occurrence_id,event_date,basis_of_record,latitude,longitude,coordinate_uncertainty,sensitive,habitat,source_asset_id,source_row) SELECT oid,_org,tid,occ,r->>'eventDate',r->>'basisOfRecord',latitude,longitude,CASE WHEN sens AND latitude IS NOT NULL THEN greatest(16000,coalesce((r->>'coordinateUncertaintyInMeters')::double precision,0)) ELSE (r->>'coordinateUncertaintyInMeters')::double precision END,sens,CASE WHEN sens THEN NULL ELSE r->>'habitat' END,_asset,CASE WHEN _asset IS NULL THEN NULL ELSE idx END FROM public.observations WHERE id=oid;
  INSERT INTO public.biodiversity_details(id,org_id,latitude,longitude,locality,recorded_by,original_metadata) VALUES(oid,_org,lat,lng,r->>'locality',r->>'recordedBy',coalesce(r->'original','{}'));
  INSERT INTO public.provenance_events(org_id,entity_kind,entity_id,event_type,agent,actor_id,details) VALUES(_org,'observation',oid,'biodiversity_imported',CASE WHEN _asset IS NULL THEN 'human' ELSE 'adapter:darwin-core' END,auth.uid(),jsonb_build_object('source_asset_id',_asset,'source_row',idx,'sensitive',sens));
  added:=added+1;
 END LOOP;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id,details) VALUES(_org,auth.uid(),'biodiversity_import','biodiversity_observations',_asset,jsonb_build_object('added',added,'skipped',skipped));
 RETURN jsonb_build_object('added',added,'skipped',skipped);
END $$;
REVOKE ALL ON FUNCTION public.import_biodiversity(uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_biodiversity(uuid,jsonb,uuid) TO authenticated;

-- Export only explicitly permitted records; exact sensitive coordinates never leave this function.
CREATE OR REPLACE FUNCTION public.export_biodiversity(_org uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_org_member(_org) THEN RAISE EXCEPTION 'Workspace access required'; END IF;
 IF EXISTS(SELECT 1 FROM public.biodiversity_observations b JOIN public.observations o ON o.id=b.id LEFT JOIN public.rights_records r ON r.id=o.rights_id WHERE b.org_id=_org AND (r.state IS DISTINCT FROM 'permitted_redistribution'::public.rights_state OR (b.source_asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assets a JOIN public.rights_records ar ON ar.id=a.rights_id WHERE a.id=b.source_asset_id AND ar.state='permitted_redistribution')))) THEN RAISE EXCEPTION 'Export blocked: every occurrence and original must permit redistribution'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('occurrenceID',b.occurrence_id,'scientificName',t.scientific_name,'eventDate',b.event_date,'basisOfRecord',b.basis_of_record,'decimalLatitude',b.latitude,'decimalLongitude',b.longitude,'coordinateUncertaintyInMeters',b.coordinate_uncertainty,'kingdom',t.kingdom,'family',t.family,'genus',t.genus,'taxonRank',t.taxon_rank,'habitat',b.habitat,'locality',CASE WHEN b.sensitive THEN NULL ELSE d.locality END,'recordedBy',CASE WHEN b.sensitive THEN NULL ELSE d.recorded_by END,'informationWithheld',CASE WHEN b.sensitive THEN 'Exact location, recorder, original metadata and habitat withheld' ELSE '' END,'dataGeneralizations',CASE WHEN b.sensitive THEN 'Coordinates are centres of 0.1 degree grid cells; uncertainty at least 16000 m' ELSE '' END,'license',r.license,'rightsHolder',r.attribution) ORDER BY b.created_at), '[]') INTO result FROM public.biodiversity_observations b JOIN public.taxa t ON t.id=b.taxon_id JOIN public.observations o ON o.id=b.id JOIN public.rights_records r ON r.id=o.rights_id LEFT JOIN public.biodiversity_details d ON d.id=b.id WHERE b.org_id=_org;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,details) VALUES(_org,auth.uid(),'biodiversity_export','biodiversity_observations',jsonb_build_object('count',jsonb_array_length(result)));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.export_biodiversity(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_biodiversity(uuid) TO authenticated;