DROP POLICY IF EXISTS "Allow read occupations for anon and authenticated" ON public.occupations;

CREATE POLICY "Allow read occupations for anon and authenticated"
ON public.occupations
FOR SELECT
TO anon, authenticated
USING (true);

