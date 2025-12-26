CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.amenities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon_key text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(user_id)
);

CREATE TABLE IF NOT EXISTS public.space_amenities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (space_id, amenity_id)
);

CREATE INDEX IF NOT EXISTS idx_space_amenities_space_id ON public.space_amenities(space_id);
CREATE INDEX IF NOT EXISTS idx_space_amenities_amenity_id ON public.space_amenities(amenity_id);

CREATE TABLE IF NOT EXISTS public.space_characteristics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon_key text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_space_characteristics_space_id ON public.space_characteristics(space_id);

INSERT INTO public.amenities (slug, name, description, icon_key)
SELECT slug, name, description, icon_key
FROM (
  VALUES
    ('highSpeedWifi', 'High-speed WiFi', NULL, 'highSpeedWifi'),
    ('printerScanner', 'Printer/Scanner', NULL, 'printerScanner'),
    ('coffeeAndTea', 'Coffee & Tea', NULL, 'coffeeAndTea'),
    ('kitchenAccess', 'Kitchen Access', NULL, 'kitchenAccess'),
    ('airConditioning', 'Air Conditioning', NULL, 'airConditioning'),
    ('naturalLight', 'Natural Light', NULL, 'naturalLight'),
    ('ergonomicFurniture', 'Ergonomic Furniture', NULL, 'ergonomicFurniture'),
    ('whiteboard', 'Whiteboard', NULL, 'whiteboard'),
    ('projectorScreen', 'Projector/Screen', NULL, 'projectorScreen'),
    ('videoConferencing', 'Video Conferencing', NULL, 'videoConferencing'),
    ('securitySystem', 'Security System', NULL, 'securitySystem'),
    ('access24x7', '24/7 Access', NULL, 'access24x7'),
    ('receptionServices', 'Reception Services', NULL, 'receptionServices'),
    ('cleaningService', 'Cleaning Service', NULL, 'cleaningService'),
    ('parking', 'Parking', NULL, 'parking'),
    ('publicTransport', 'Public Transport', NULL, 'publicTransport'),
    ('bikeStorage', 'Bike Storage', NULL, 'bikeStorage'),
    ('showerFacilities', 'Shower Facilities', NULL, 'showerFacilities'),
    ('phoneBooth', 'Phone Booth', NULL, 'phoneBooth'),
    ('lockers', 'Lockers', NULL, 'lockers')
) AS seed(slug, name, description, icon_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.amenities existing WHERE existing.slug = seed.slug
);
