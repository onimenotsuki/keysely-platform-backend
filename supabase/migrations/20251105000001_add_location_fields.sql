-- Add latitude and longitude columns to spaces table
ALTER TABLE public.spaces 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Create index for geospatial queries
CREATE INDEX idx_spaces_location ON public.spaces(latitude, longitude);

-- Add comment to document the columns
COMMENT ON COLUMN public.spaces.latitude IS 'Latitude coordinate for space location';
COMMENT ON COLUMN public.spaces.longitude IS 'Longitude coordinate for space location';


