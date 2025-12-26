-- Add interest_id column to tour_tags table to support interests
-- This allows tour_tags to link to both tags (via tag_id) and interests (via interest_id)

-- Add interest_id column if it doesn't exist
ALTER TABLE tour_tags 
ADD COLUMN IF NOT EXISTS interest_id UUID REFERENCES interests(id) ON DELETE CASCADE;

-- Create index for interest_id
CREATE INDEX IF NOT EXISTS idx_tour_tags_interest_id ON tour_tags(interest_id);

-- Add check constraint to ensure either tag_id or interest_id is set (but not both)
ALTER TABLE tour_tags
DROP CONSTRAINT IF EXISTS tour_tags_tag_or_interest_check;

ALTER TABLE tour_tags
ADD CONSTRAINT tour_tags_tag_or_interest_check 
CHECK (
  (tag_id IS NOT NULL AND interest_id IS NULL) OR 
  (tag_id IS NULL AND interest_id IS NOT NULL)
);

-- Add unique indexes to ensure uniqueness for both tag_id and interest_id cases
-- These partial indexes ensure that we can't have duplicate (tour_id, tag_id) or (tour_id, interest_id)
CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_tag 
ON tour_tags(tour_id, tag_id) 
WHERE tag_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_interest 
ON tour_tags(tour_id, interest_id) 
WHERE interest_id IS NOT NULL;

-- Note: If the table already has a PRIMARY KEY on (tour_id, tag_id), we need to handle that
-- For now, we'll keep the existing structure and rely on unique indexes for interest_id
-- If you need to change the PRIMARY KEY, you'll need to:
-- 1. Drop the existing PRIMARY KEY: ALTER TABLE tour_tags DROP CONSTRAINT tour_tags_pkey;
-- 2. Add an id column: ALTER TABLE tour_tags ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

