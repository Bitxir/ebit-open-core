-- Originals bucket: path = <org_id>/<asset_id>/<file>. Members read; contributors upload; nobody updates or deletes originals.
CREATE POLICY originals_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'originals' AND public.is_org_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY originals_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'originals' AND public.is_org_member(((storage.foldername(name))[1])::uuid, 'contributor'));
