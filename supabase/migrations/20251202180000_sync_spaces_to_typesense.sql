-- Migration to create the Typesense sync trigger
-- This trigger calls the 'sync-spaces-to-typesense' Edge Function whenever a row in 'public.spaces' is inserted, updated, or deleted.

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 1. Create the function that builds the payload and calls the Edge Function
CREATE OR REPLACE FUNCTION public.handle_spaces_typesense_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  -- REPLACE WITH YOUR PROJECT URL (e.g., https://<project-ref>.supabase.co/functions/v1/sync-spaces-to-typesense)
  -- For local development: http://host.docker.internal:54321/functions/v1/sync-spaces-to-typesense
  request_url text := 'http://kong:8000/functions/v1/sync-spaces-to-typesense';
  
  -- REPLACE WITH YOUR SERVICE ROLE KEY
  service_role_key text := 'f1485fd94b8f784294be421c341ff56827493c3964c1bc3c3f90f8fc03dcf4fc';
BEGIN
  -- Construct the payload matching the standard Supabase webhook format
  payload = jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', row_to_json(OLD)
  );

  -- Send the request to the Edge Function using pg_net
  -- We use a timeout of 5000ms (5 seconds)
  BEGIN
    PERFORM "net"."http_post"(
      url := request_url,
      body := payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      timeout_milliseconds := 5000
    ) as "request_id";
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to sync space to Typesense: % %', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS "sync-spaces-to-typesense-trigger" ON "public"."spaces";

CREATE TRIGGER "sync-spaces-to-typesense-trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "public"."spaces"
FOR EACH ROW
EXECUTE FUNCTION public.handle_spaces_typesense_sync();
