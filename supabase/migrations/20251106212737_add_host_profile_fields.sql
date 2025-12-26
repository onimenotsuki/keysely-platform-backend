-- Add host profile fields to profiles table
-- This migration adds fields needed for the public host profile feature

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_rate integer DEFAULT NULL CHECK (response_rate >= 0 AND response_rate <= 100),
ADD COLUMN IF NOT EXISTS response_time_hours integer DEFAULT NULL CHECK (response_time_hours > 0),
ADD COLUMN IF NOT EXISTS is_identity_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_superhost boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS work_description text DEFAULT NULL;

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN profiles.languages IS 'Array of languages the host speaks (e.g., Spanish, English, French)';
COMMENT ON COLUMN profiles.response_rate IS 'Percentage of messages responded to (0-100)';
COMMENT ON COLUMN profiles.response_time_hours IS 'Average response time in hours';
COMMENT ON COLUMN profiles.is_identity_verified IS 'Whether the host has verified their identity';
COMMENT ON COLUMN profiles.is_superhost IS 'Whether the host has superhost status';
COMMENT ON COLUMN profiles.work_description IS 'Professional description or current work';

-- Create index for faster queries on superhost status
CREATE INDEX IF NOT EXISTS idx_profiles_is_superhost ON profiles(is_superhost) WHERE is_superhost = true;

-- Create index for identity verification
CREATE INDEX IF NOT EXISTS idx_profiles_is_identity_verified ON profiles(is_identity_verified) WHERE is_identity_verified = true;

