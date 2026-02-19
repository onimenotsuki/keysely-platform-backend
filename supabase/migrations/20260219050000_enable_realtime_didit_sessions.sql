-- Enable Realtime for didit_sessions table
-- This allows the frontend to subscribe to changes in real-time
alter publication supabase_realtime add table public.didit_sessions;
