-- =============================================================================
-- Allow anon to read only id and is_verified from identity_documents
-- via a view (RLS is row-level; view restricts columns)
-- =============================================================================

CREATE OR REPLACE VIEW public.identity_documents_verification
WITH (security_invoker = false)
AS
  SELECT id, is_verified
  FROM public.identity_documents;

COMMENT ON VIEW public.identity_documents_verification IS
  'Public verification status; anon can SELECT to get is_verified by document id.';

GRANT SELECT ON public.identity_documents_verification TO anon;
