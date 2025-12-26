-- Add UNIQUE constraint to prevent duplicate reviews for the same booking
ALTER TABLE public.reviews
ADD CONSTRAINT reviews_user_booking_unique UNIQUE (user_id, booking_id);

-- Add indexes for better performance on review validations
CREATE INDEX IF NOT EXISTS idx_reviews_booking_user ON public.reviews(booking_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_space_user ON public.reviews(space_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON public.bookings(user_id, status, payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_space_status ON public.bookings(space_id, status, payment_status);

-- Add index for booking end date/time queries (used in review time validation)
CREATE INDEX IF NOT EXISTS idx_bookings_end_date_time ON public.bookings(end_date, end_time);

