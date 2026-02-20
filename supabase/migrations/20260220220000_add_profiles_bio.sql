-- =============================================================================
-- Add optional bio column to profiles (self-description, max 250 characters)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio varchar(250);

COMMENT ON COLUMN public.profiles.bio IS 'Optional self-description or bio, max 250 characters.';
