-- Add is_host field to profiles table
-- This migration adds a field to identify users who are hosts (can publish spaces)
-- Both hosts and regular users can rent spaces

-- Add new column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_host boolean DEFAULT false;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN profiles.is_host IS 'Indicates if the user is a host (can publish spaces). Both hosts and regular users can rent spaces.';

-- Create index for faster queries filtering by hosts
CREATE INDEX IF NOT EXISTS idx_profiles_is_host ON profiles(is_host) WHERE is_host = true;

