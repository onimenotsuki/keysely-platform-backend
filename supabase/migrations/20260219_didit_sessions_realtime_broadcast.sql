-- Migration: Enable Realtime Broadcast for didit_sessions
-- Follows https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
--
-- This uses the recommended Broadcast approach instead of Postgres Changes.
-- The trigger calls realtime.broadcast_changes() which sends events
-- to a private channel that requires Realtime Authorization.

-- 1. RLS policy: allow authenticated users to receive broadcasts
-- (skip if you already have a broader policy on realtime.messages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename  = 'messages'
      AND policyname = 'Authenticated users can receive broadcasts'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON realtime.messages FOR SELECT TO authenticated USING (true)',
      'Authenticated users can receive broadcasts'
    );
  END IF;
END
$$;

-- 2. Trigger function: broadcast changes on didit_sessions
-- Topic format: didit_session:<session_id>  (matches the client channel name)
CREATE OR REPLACE FUNCTION public.didit_sessions_broadcast_changes()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'didit_session:' || coalesce(NEW.session_id, OLD.session_id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;

-- 3. Trigger: fire after every insert / update / delete on didit_sessions
DROP TRIGGER IF EXISTS handle_didit_sessions_broadcast ON public.didit_sessions;

CREATE TRIGGER handle_didit_sessions_broadcast
AFTER INSERT OR UPDATE OR DELETE
ON public.didit_sessions
FOR EACH ROW
EXECUTE FUNCTION public.didit_sessions_broadcast_changes();
