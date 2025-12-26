-- Function to update space rating and total reviews count
-- This function calculates the average rating (rounded to 1 decimal place) and updates the space
-- Formula: ROUND(AVG(rating), 1) - rounds to 1 decimal place (e.g., 4.69 → 4.7, 4.65 → 4.7, 4.64 → 4.6)
CREATE OR REPLACE FUNCTION public.update_space_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  space_id_var uuid;
  avg_rating numeric(2,1);
  review_count integer;
BEGIN
  -- Determine which space_id to update
  IF TG_OP = 'DELETE' THEN
    space_id_var := OLD.space_id;
  ELSE
    space_id_var := NEW.space_id;
  END IF;

  -- Calculate average rating and total reviews for the space
  -- Formula: ROUND(AVG(rating), 1) - rounds to 1 decimal place using standard rounding
  -- Example: AVG of [4, 5, 5] = 4.666... → ROUND(4.666..., 1) = 4.7
  -- Example: AVG of [4, 4, 5] = 4.333... → ROUND(4.333..., 1) = 4.3
  -- Example: AVG of [4, 5] = 4.5 → ROUND(4.5, 1) = 4.5
  -- Example: AVG of [3, 4, 5] = 4.0 → ROUND(4.0, 1) = 4.0
  SELECT 
    COALESCE(ROUND(AVG(rating::numeric), 1), 0)::numeric(2,1),
    COUNT(*)::integer
  INTO 
    avg_rating,
    review_count
  FROM public.reviews
  WHERE space_id = space_id_var;

  -- Update the space with new rating and review count
  UPDATE public.spaces
  SET 
    rating = avg_rating,
    total_reviews = review_count,
    updated_at = NOW()
  WHERE id = space_id_var;

  -- Return the appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger to automatically update space rating when reviews are inserted
CREATE TRIGGER trigger_update_space_rating_on_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_space_rating();

-- Create trigger to automatically update space rating when reviews are updated
CREATE TRIGGER trigger_update_space_rating_on_update
  AFTER UPDATE ON public.reviews
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.space_id IS DISTINCT FROM NEW.space_id)
  EXECUTE FUNCTION public.update_space_rating();

-- Create trigger to automatically update space rating when reviews are deleted
CREATE TRIGGER trigger_update_space_rating_on_delete
  AFTER DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_space_rating();

-- Add index on space_id in reviews table for better performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_reviews_space_id ON public.reviews(space_id);

