-- Grant explicit permissions to service_role for didit_sessions table
-- This ensures Edge Functions using SUPABASE_SERVICE_ROLE_KEY can insert/update sessions
-- Fixes "permission denied for schema public" error (code 42501)

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.didit_sessions TO service_role;
