DROP POLICY IF EXISTS "keysely_legal_docs_read_only" ON storage.objects;
CREATE POLICY "keysely_legal_docs_read_only" ON storage.objects FOR
SELECT USING (
    bucket_id = 'keysely_legal_docs'
    AND auth.role() = 'authenticated'
    AND storage.extension(name) = 'pdf'
  );

GRANT SELECT ON TABLE storage.objects TO anon, authenticated;