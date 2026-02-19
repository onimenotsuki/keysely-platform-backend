-- Conceder permisos en identity_documents a anon y authenticated.
-- RLS ya restringe SELECT/UPDATE por usuario; sin GRANT la tabla devuelve 42501.
GRANT SELECT, INSERT, UPDATE ON public.identity_documents TO anon, authenticated;
