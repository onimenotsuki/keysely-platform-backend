-- Create Didit Sessions Table
-- Stores verification session status and metadata updated by webhooks
create table if not exists public.didit_sessions (
  session_id uuid primary key,
  status text not null check (status in (
    'Not Started',
    'In Progress',
    'In Review',
    'Resubmitted',
    'Approved',
    'Declined',
    'Abandoned',
    'Expired'
  )),
  webhook_type text not null check (webhook_type in ('status.updated', 'data.updated')),
  vendor_data text,
  workflow_id uuid,
  metadata jsonb default '{}'::jsonb,
  decision jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index on vendor_data for quick lookups
create index if not exists idx_didit_sessions_vendor_data on public.didit_sessions(vendor_data);

-- Create index on status for filtering
create index if not exists idx_didit_sessions_status on public.didit_sessions(status);

-- Create index on workflow_id for filtering
create index if not exists idx_didit_sessions_workflow_id on public.didit_sessions(workflow_id);

-- Enable RLS
alter table public.didit_sessions enable row level security;

-- Policy: Users can view sessions where vendor_data matches their user_id or email
-- This allows users to see their own verification sessions
create policy "Users can view their own sessions" on public.didit_sessions
  for select
  using (
    vendor_data = auth.uid()::text
    or vendor_data = (select email from auth.users where id = auth.uid())
  );

-- Policy: Service role can insert/update (for webhook)
-- Webhook uses service role key, so it can upsert any session
create policy "Service role can manage sessions" on public.didit_sessions
  for all
  using (true)
  with check (true);

-- Function to update updated_at timestamp
create or replace function update_didit_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_didit_sessions_updated_at
  before update on public.didit_sessions
  for each row
  execute function update_didit_sessions_updated_at();
