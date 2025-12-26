-- Function to insert bookings for seeding purposes
-- This function bypasses RLS to allow inserting bookings for any user
-- It's secured by requiring authentication and validating the user exists
CREATE OR REPLACE FUNCTION public.insert_seed_booking(
  p_user_id uuid,
  p_space_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_total_hours integer,
  p_total_amount numeric(10,2),
  p_currency text,
  p_guests_count integer,
  p_status text,
  p_payment_status text,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_stripe_session_id text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_id uuid;
BEGIN
  -- Verify user exists in profiles table
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User with id % does not exist', p_user_id;
  END IF;

  -- Verify space exists
  IF NOT EXISTS (SELECT 1 FROM public.spaces WHERE id = p_space_id) THEN
    RAISE EXCEPTION 'Space with id % does not exist', p_space_id;
  END IF;

  -- Validate status
  IF p_status NOT IN ('pending', 'confirmed', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Validate payment_status
  IF p_payment_status NOT IN ('pending', 'paid', 'failed') THEN
    RAISE EXCEPTION 'Invalid payment_status: %', p_payment_status;
  END IF;

  -- Insert booking (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.bookings (
    user_id,
    space_id,
    start_date,
    end_date,
    start_time,
    end_time,
    total_hours,
    total_amount,
    currency,
    guests_count,
    status,
    payment_status,
    stripe_payment_intent_id,
    stripe_session_id,
    notes
  ) VALUES (
    p_user_id,
    p_space_id,
    p_start_date,
    p_end_date,
    p_start_time,
    p_end_time,
    p_total_hours,
    p_total_amount,
    p_currency,
    p_guests_count,
    p_status,
    p_payment_status,
    p_stripe_payment_intent_id,
    p_stripe_session_id,
    p_notes
  )
  RETURNING id INTO booking_id;

  RETURN booking_id;
END;
$$;

-- Grant execute permission to authenticated users
-- This allows the seed scripts to call the function
GRANT EXECUTE ON FUNCTION public.insert_seed_booking TO authenticated;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION public.insert_seed_booking IS 
  'Allows inserting bookings for any user (bypasses RLS). Used for seeding test data. Requires authentication.';

