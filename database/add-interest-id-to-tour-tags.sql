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

-- Update primary key to work with both tag_id and interest_id
-- Since we can't use COALESCE in PRIMARY KEY, we'll use a unique constraint
-- First, drop the existing primary key if it exists
ALTER TABLE tour_tags
DROP CONSTRAINT IF EXISTS tour_tags_pkey;

-- Add a unique constraint that ensures uniqueness for both tag_id and interest_id cases
-- We'll create a unique index that handles both cases
CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_tag 
ON tour_tags(tour_id, tag_id) 
WHERE tag_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_interest 
ON tour_tags(tour_id, interest_id) 
WHERE interest_id IS NOT NULL;

-- Add a simple primary key on tour_id (we rely on unique indexes for uniqueness)
-- Or we can add an id column and use that as primary key
-- For now, let's add an id column to make it easier
ALTER TABLE tour_tags
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- If id column already exists, just ensure it's the primary key
-- ALTER TABLE tour_tags
-- ADD CONSTRAINT tour_tags_pkey PRIMARY KEY (id);

