-- =============================================================================
-- Allow anonymous SELECT on profiles table
-- Profiles already have GRANT SELECT TO anon, but need RLS policy
-- =============================================================================

-- Policy to allow anonymous users to view all profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Ensure GRANT is in place (idempotent)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.occupations TO anon;
