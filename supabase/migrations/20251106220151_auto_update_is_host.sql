-- Auto-update is_host field when a user creates a space
-- This migration ensures that when a user creates a space, they are automatically marked as a host

-- Create function to mark user as host when they create a space
CREATE OR REPLACE FUNCTION public.mark_user_as_host()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Update the profile to mark the user as a host
  UPDATE public.profiles
  SET is_host = true
  WHERE user_id = NEW.owner_id AND (is_host IS NULL OR is_host = false);
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires after a space is inserted
CREATE TRIGGER on_space_created_mark_as_host
  AFTER INSERT ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_user_as_host();

-- Fix existing data: mark all users who already have spaces as hosts
UPDATE public.profiles
SET is_host = true
WHERE user_id IN (
  SELECT DISTINCT owner_id 
  FROM public.spaces
)
AND (is_host IS NULL OR is_host = false);

-- Add comment
COMMENT ON FUNCTION public.mark_user_as_host() IS 'Automatically marks a user as a host when they create a space';

