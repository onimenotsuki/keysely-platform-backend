-- Migration: Enable Realtime for didit_sessions (Broadcast + Postgres Changes)
-- @see https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
--
-- 1) Broadcast: trigger sends events to channel didit_session:<session_id>
--    (requires RLS on realtime.messages).
-- 2) Postgres Changes: table in supabase_realtime publication for .on('postgres_changes', ...).

-- ---------------------------------------------------------------------------
-- Broadcast: RLS so authenticated users can receive broadcasts
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Broadcast: trigger function and trigger on didit_sessions
-- ---------------------------------------------------------------------------
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

DROP TRIGGER IF EXISTS handle_didit_sessions_broadcast ON public.didit_sessions;

CREATE TRIGGER handle_didit_sessions_broadcast
AFTER INSERT OR UPDATE OR DELETE
ON public.didit_sessions
FOR EACH ROW
EXECUTE FUNCTION public.didit_sessions_broadcast_changes();

-- ---------------------------------------------------------------------------
-- Postgres Changes: ensure publication and add didit_sessions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'didit_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.didit_sessions;
  END IF;
END
$$;
