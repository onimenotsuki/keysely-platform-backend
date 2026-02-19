
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.space_types TO authenticated;

DROP POLICY IF EXISTS "Allow read space types for anon and authenticated" ON public.space_types;
CREATE POLICY "Allow read space types for anon and authenticated"
ON public.space_types
FOR SELECT
TO anon, authenticated
USING (true);
GRANT SELECT ON public.space_types TO authenticated;