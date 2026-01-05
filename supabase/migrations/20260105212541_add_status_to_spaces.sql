-- Create ENUM type for space status
CREATE TYPE space_status AS ENUM (
  'draft',
  'pending_review',
  'in_review',
  'published'
);

-- Add status column to spaces table with default value
ALTER TABLE spaces 
  ADD COLUMN status space_status NOT NULL DEFAULT 'draft';

-- Create index for better query performance on status
CREATE INDEX idx_spaces_status ON spaces(status);