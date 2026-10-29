-- Preserve null coordinates and recognize sensitive opaque IDs on import replay.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.import_biodiversity(uuid,jsonb,uuid)'::regprocedure) INTO definition;
 definition := replace(definition,'occurrence_id=occ OR (source_asset_id=_asset AND source_row=idx)','occurrence_id=occ OR occurrence_id=''OCC-'' || md5(_org::text || '':'' || occ) OR (source_asset_id=_asset AND source_row=idx)');
 definition := replace(definition,'CASE WHEN sens THEN least(89.95,floor(lat*10)/10+0.05) ELSE lat END','CASE WHEN lat IS NULL THEN NULL WHEN sens THEN least(89.95,floor(lat*10)/10+0.05) ELSE lat END');
 definition := replace(definition,'CASE WHEN sens THEN least(179.95,floor(lng*10)/10+0.05) ELSE lng END','CASE WHEN lng IS NULL THEN NULL WHEN sens THEN least(179.95,floor(lng*10)/10+0.05) ELSE lng END');
 definition := replace(definition,'INSERT INTO public.rights_records(org_id,state,license,attribution,source,created_by)', E'IF (lat IS NULL) <> (lng IS NULL) OR lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION ''Invalid coordinates''; END IF;\n  IF r->>''eventDate'' IS NOT NULL AND (r->>''eventDate'') !~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}(T.*)?$'' THEN RAISE EXCEPTION ''Invalid event date''; END IF;\n  INSERT INTO public.rights_records(org_id,state,license,attribution,source,created_by)');
 EXECUTE definition;
END $$;