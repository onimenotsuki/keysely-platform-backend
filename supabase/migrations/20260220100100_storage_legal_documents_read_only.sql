DROP POLICY IF EXISTS "keysely_legal_documents_read_only" ON storage.objects;

CREATE POLICY "keysely_legal_documents_read_only"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'keysely_legal_documents'
  AND storage.extension(name) = 'pdf'  -- only allow reading .pdf files
  AND (auth.role() = 'anon' OR auth.role() = 'authenticated')
);
