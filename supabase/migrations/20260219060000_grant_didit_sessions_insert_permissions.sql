-- Grant insert and update permissions for didit_sessions table
-- Allows authenticated users to insert/update sessions where vendor_data matches their user_id or email
-- Note: Service role key (used by edge functions) bypasses RLS automatically, so it can insert/update any session

-- Grant explicit permissions to service_role for schema and table access
-- This ensures Edge Functions using SUPABASE_SERVICE_ROLE_KEY can insert/update sessions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.didit_sessions TO service_role;

-- Policy: Users can insert sessions where vendor_data matches their user_id or email
create policy "Users can insert their own sessions" on public.didit_sessions
  for insert
  with check (
    vendor_data = auth.uid()::text
    or vendor_data = (select email from auth.users where id = auth.uid())
  );

-- Policy: Users can update sessions where vendor_data matches their user_id or email
create policy "Users can update their own sessions" on public.didit_sessions
  for update
  using (
    vendor_data = auth.uid()::text
    or vendor_data = (select email from auth.users where id = auth.uid())
  )
  with check (
    vendor_data = auth.uid()::text
    or vendor_data = (select email from auth.users where id = auth.uid())
  );
