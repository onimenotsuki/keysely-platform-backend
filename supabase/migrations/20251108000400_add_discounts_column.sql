ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS discounts JSONB;

COMMENT ON COLUMN public.spaces.discounts IS 'Applied discount percentages keyed by discount type (e.g., newListing, lastMinute).';
