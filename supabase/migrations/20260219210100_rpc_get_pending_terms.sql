-- RPC: returns active terms that the current user (profile) has not accepted
create or replace function public.get_pending_terms()
returns table(term_id uuid, type varchar, version varchar)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select td.id, td.type::varchar, td.version::varchar
  from public.terms_definitions td
  left join public.user_terms_acceptance uta
    on td.id = uta.term_id and uta.profile_id = auth.uid()
  where td.is_active = true
    and td.effective_at <= current_timestamp
    and uta.id is null;
end;
$$;

grant execute on function public.get_pending_terms() to authenticated;
