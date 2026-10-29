CREATE TABLE public.api_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), key_prefix text NOT NULL, key_hash text NOT NULL UNIQUE CHECK(key_hash ~ '^[a-f0-9]{64}$'),
 rate_limit_per_minute int NOT NULL DEFAULT 60 CHECK(rate_limit_per_minute BETWEEN 1 AND 600),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, last_used_at timestamptz
);
GRANT SELECT ON public.api_keys TO authenticated; GRANT ALL ON public.api_keys TO service_role;
REVOKE SELECT (key_hash) ON public.api_keys FROM authenticated;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_read ON public.api_keys FOR SELECT TO authenticated USING(public.is_org_member(org_id,'admin'));

CREATE TABLE public.api_usage (
 key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE, window_start timestamptz NOT NULL, count int NOT NULL DEFAULT 0,
 PRIMARY KEY(key_id,window_start)
);
GRANT ALL ON public.api_usage TO service_role;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.issue_api_key(_org uuid,_name text,_hash text,_prefix text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kid uuid;
BEGIN
 IF NOT public.is_org_member(_org,'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF _hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid key hash'; END IF;
 INSERT INTO public.api_keys(org_id,name,key_hash,key_prefix,created_by) VALUES(_org,_name,_hash,_prefix,auth.uid()) RETURNING id INTO kid;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id,details) VALUES(_org,auth.uid(),'api_key_issued','api_keys',kid,jsonb_build_object('prefix',_prefix));
 RETURN kid;
END $$;
REVOKE ALL ON FUNCTION public.issue_api_key(uuid,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.issue_api_key(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_api_key(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid;
BEGIN
 SELECT org_id INTO o FROM public.api_keys WHERE id=_id;
 IF o IS NULL OR NOT public.is_org_member(o,'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 UPDATE public.api_keys SET revoked_at=now() WHERE id=_id AND revoked_at IS NULL;
 INSERT INTO public.audit_log(org_id,actor_id,action,target_table,target_id,details) VALUES(o,auth.uid(),'api_key_revoked','api_keys',_id,'{}');
END $$;
REVOKE ALL ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;

-- Public read API: authenticates key, rate-limits, returns only published datasets whose rights AND every item's rights permit redistribution.
CREATE OR REPLACE FUNCTION public.api_read(_hash text,_resource text,_dataset text DEFAULT NULL,_page int DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k public.api_keys; used int; ds public.datasets; lim int:=100; off int; result jsonb;
BEGIN
 SELECT * INTO k FROM public.api_keys WHERE key_hash=_hash AND revoked_at IS NULL;
 IF k.id IS NULL THEN RAISE EXCEPTION 'Invalid API key' USING ERRCODE='28000'; END IF;
 INSERT INTO public.api_usage(key_id,window_start,count) VALUES(k.id,date_trunc('minute',now()),1)
  ON CONFLICT(key_id,window_start) DO UPDATE SET count=public.api_usage.count+1 RETURNING count INTO used;
 IF used>k.rate_limit_per_minute THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE='54000'; END IF;
 UPDATE public.api_keys SET last_used_at=now() WHERE id=k.id;
 DELETE FROM public.api_usage WHERE key_id=k.id AND window_start<now()-interval '1 hour';
 off:=(greatest(coalesce(_page,1),1)-1)*lim;
 IF _resource='datasets' THEN
  SELECT jsonb_build_object('data',coalesce(jsonb_agg(jsonb_build_object('id',d.ebit_id,'title',d.title,'description',d.description,'license',r.license,'attribution',r.attribution,'items',(SELECT count(*) FROM public.dataset_items i WHERE i.dataset_id=d.id),'created_at',d.created_at) ORDER BY d.created_at),'[]'),'page',greatest(coalesce(_page,1),1)) INTO result
  FROM (SELECT * FROM public.datasets WHERE org_id=k.org_id AND published ORDER BY created_at LIMIT lim OFFSET off) d JOIN public.rights_records r ON r.id=d.rights_id AND r.state='permitted_redistribution';
  RETURN result;
 END IF;
 SELECT d.* INTO ds FROM public.datasets d JOIN public.rights_records r ON r.id=d.rights_id AND r.state='permitted_redistribution' WHERE d.org_id=k.org_id AND d.published AND d.ebit_id=_dataset;
 IF ds.id IS NULL THEN RAISE EXCEPTION 'Dataset not found' USING ERRCODE='P0002'; END IF;
 IF _resource='items' THEN
  WITH it AS (SELECT * FROM public.dataset_items WHERE dataset_id=ds.id ORDER BY added_at,entity_id LIMIT lim OFFSET off)
  SELECT jsonb_build_object('dataset',ds.ebit_id,'page',greatest(coalesce(_page,1),1),'data',coalesce(jsonb_agg(x.j),'[]')) INTO result FROM (
   SELECT jsonb_build_object('kind','object','id',o.ebit_id,'name',o.name,'type',o.object_type,'description',o.description,'latitude',o.latitude,'longitude',o.longitude,'license',r.license,'attribution',r.attribution) j
    FROM it JOIN public.objects o ON it.entity_kind='object' AND o.id=it.entity_id JOIN public.rights_records r ON r.id=o.rights_id AND r.state='permitted_redistribution'
   UNION ALL
   SELECT jsonb_build_object('kind','observation','id',o.ebit_id,'type',o.observation_type,'observed_at',o.observed_at,'latitude',o.latitude,'longitude',o.longitude,'value_numeric',o.value_numeric,'value_text',o.value_text,'unit',o.unit,'verification_status',o.verification_status,'scientificName',t.scientific_name,'sensitive',coalesce(b.sensitive,false),'license',r.license,'attribution',r.attribution)
    FROM it JOIN public.observations o ON it.entity_kind='observation' AND o.id=it.entity_id JOIN public.rights_records r ON r.id=o.rights_id AND r.state='permitted_redistribution'
    LEFT JOIN public.biodiversity_observations b ON b.id=o.id LEFT JOIN public.taxa t ON t.id=b.taxon_id
   UNION ALL
   SELECT jsonb_build_object('kind','asset','id',a.ebit_id,'asset_kind',a.kind,'mime_type',a.mime_type,'file_name',a.file_name,'byte_size',a.byte_size,'sha256',a.sha256,'license',r.license,'attribution',r.attribution)
    FROM it JOIN public.assets a ON it.entity_kind='asset' AND a.id=it.entity_id JOIN public.rights_records r ON r.id=a.rights_id AND r.state='permitted_redistribution'
  ) x;
  RETURN result;
 END IF;
 RAISE EXCEPTION 'Unknown resource' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.api_read(text,text,text,int) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.api_read(text,text,text,int) TO service_role;