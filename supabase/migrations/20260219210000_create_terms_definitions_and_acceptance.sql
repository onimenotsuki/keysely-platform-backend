-- Terms definitions: metadata and SHA-256 hash of legal documents (T&C, Privacy, etc.).
-- Insert-only for new versions; client has SELECT only (backend/service role inserts).
create table if not exists public.terms_definitions (
  id uuid primary key default gen_random_uuid(),
  type varchar not null,
  version varchar not null,
  content_hash text not null,
  is_active boolean not null default true,
  effective_at timestamp with time zone not null,
  created_at timestamp with time zone not null default (timezone('utc'::text, now()))
);

-- RLS: authenticated can only read active terms
alter table public.terms_definitions enable row level security;

create policy "Authenticated can view active terms"
  on public.terms_definitions
  for select
  to authenticated
  using (is_active = true);

-- User terms acceptance: append-only audit log keyed by profile
create table if not exists public.user_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null references public.terms_definitions(id) on delete cascade,
  accepted_at timestamp with time zone not null default (timezone('utc'::text, now()))
);

create index if not exists idx_user_terms_acceptance_profile_term
  on public.user_terms_acceptance(profile_id, term_id);

alter table public.user_terms_acceptance enable row level security;

create policy "Users can view their own acceptances"
  on public.user_terms_acceptance
  for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "Users can insert their own acceptances"
  on public.user_terms_acceptance
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

-- Grants
grant select on public.terms_definitions to authenticated;
grant select, insert on public.user_terms_acceptance to authenticated;
