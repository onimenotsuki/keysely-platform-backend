-- Add onboarding fields to profiles table
-- This migration adds fields needed for the user onboarding flow

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS occupation text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS date_of_birth date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS address jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone DEFAULT NULL;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN profiles.occupation IS 'User occupation or job title';
COMMENT ON COLUMN profiles.date_of_birth IS 'User date of birth';
COMMENT ON COLUMN profiles.address IS 'User physical address in JSON format (streetAddress, city, state, postalCode, country)';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether the user has completed the onboarding wizard';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Timestamp when onboarding was completed';

-- Create index for faster queries on onboarding status
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON profiles(onboarding_completed) WHERE onboarding_completed = false;

