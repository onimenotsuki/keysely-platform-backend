-- =============================================================================
-- Profile page: bookings, spaces, reviews, review_tags
-- Aligns with: ProfileBookingHistory, ProfileReviews, ProfileRatingBadges
-- Depends on: profiles, space_types (from 20260218165236_create_profile_table)
-- =============================================================================

-- Enum for booking status (used by ProfileBookingCard)
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('COMPLETED', 'UPCOMING', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- spaces: individual listings/spaces that guests can book (space_types = categories)
-- Used for: spaceName, location, imageUrl in ProfileBookingCard
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  image_url text,
  space_type_id bigint REFERENCES public.space_types(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.spaces IS 'Listings/spaces that guests can book; owner is the host.';

-- -----------------------------------------------------------------------------
-- bookings: guest reservations
-- Used for: ProfileBookingHistory, ProfileBookingCard (id, spaceName, location, bookingType, date, status, imageUrl)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  booking_type text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status booking_status NOT NULL DEFAULT 'UPCOMING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_profile_id ON public.bookings(profile_id);
CREATE INDEX IF NOT EXISTS idx_bookings_space_id ON public.bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON public.bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

COMMENT ON TABLE public.bookings IS 'Guest bookings; profile_id is the guest.';

-- -----------------------------------------------------------------------------
-- reviews: host-written reviews about guests (one per booking)
-- Used for: ProfileReviews, ProfileReviewCard (hostName, hostSpace, rating, date, text, tags)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  rating numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_guest_id ON public.reviews(guest_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);

COMMENT ON TABLE public.reviews IS 'Host reviews about guests; one review per booking.';

-- -----------------------------------------------------------------------------
-- review_tags: tags on a review (e.g. "Puntual", "Profesional", "Espacio limpio")
-- Used for: ProfileReviewCard tags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  tag_label text NOT NULL,
  UNIQUE(review_id, tag_label)
);

CREATE INDEX IF NOT EXISTS idx_review_tags_review_id ON public.review_tags(review_id);

COMMENT ON TABLE public.review_tags IS 'Tags per review (e.g. Puntual, Profesional).';

-- -----------------------------------------------------------------------------
-- Trigger to keep spaces.updated_at and bookings.updated_at in sync
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_spaces_updated_at ON public.spaces;
CREATE TRIGGER set_spaces_updated_at
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
