-- Expose terms_definitions via the Data API (removes "API DISABLED" in Dashboard).
-- Both anon and authenticated need at least one privilege for the table to be enabled; RLS restricts rows.
grant select on table public.terms_definitions to anon, authenticated;

-- Allow anon to read active terms (e.g. for T&C before login). authenticated already has a policy.
drop policy if exists "Anon can view active terms" on public.terms_definitions;
create policy "Anon can view active terms"
  on public.terms_definitions
  for select
  to anon
  using (is_active = true);
