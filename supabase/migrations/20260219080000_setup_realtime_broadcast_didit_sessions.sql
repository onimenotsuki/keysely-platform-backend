-- Setup Realtime Broadcast for didit_sessions table
-- This implements the recommended Broadcast method for real-time database changes
-- Reference: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes

-- Step 1: Create broadcast authorization policy
-- Allows authenticated users to receive broadcasts from didit_sessions topics
create policy "Authenticated users can receive didit_sessions broadcasts"
on "realtime"."messages"
for select
to authenticated
using ( true );

-- Step 2: Create trigger function for broadcasting changes
-- This function broadcasts changes to topic: didit_session:<session_id>
create or replace function public.didit_sessions_changes()
returns trigger
security definer
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'didit_session:' || coalesce(NEW.session_id, OLD.session_id)::text,  -- topic - specific to each session
    TG_OP,                                                                -- event - INSERT, UPDATE, or DELETE
    TG_OP,                                                                -- operation - same as event
    TG_TABLE_NAME,                                                        -- table - didit_sessions
    TG_TABLE_SCHEMA,                                                      -- schema - public
    NEW,                                                                  -- new record - after change
    OLD                                                                   -- old record - before change
  );
  return null;
end;
$$;

-- Step 3: Create trigger to execute function on table changes
-- Executes after INSERT, UPDATE, or DELETE operations
create trigger handle_didit_sessions_changes
after insert or update or delete
on public.didit_sessions
for each row
execute function didit_sessions_changes();
