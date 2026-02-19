GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.occupations TO anon;
GRANT SELECT ON public.occupations TO authenticated;

DROP POLICY IF EXISTS "Allow read occupations for anon and authenticated" ON public.occupations;
CREATE POLICY "Allow read occupations for anon and authenticated"
ON public.occupations
FOR SELECT
TO anon, authenticated
USING (true);
