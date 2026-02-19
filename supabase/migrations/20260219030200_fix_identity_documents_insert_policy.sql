
DROP POLICY IF EXISTS "Users can select identity documents" ON public.identity_documents;

CREATE POLICY "Users can select identity documents"
  ON public.identity_documents
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT ON public.identity_documents TO authenticated;
GRANT SELECT, INSERT ON public.identity_documents TO anon;
