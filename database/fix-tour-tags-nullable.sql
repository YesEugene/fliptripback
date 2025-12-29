-- Fix tour_tags table to allow NULL tag_id for interests
-- This migration makes tag_id nullable and removes it from PRIMARY KEY

-- Step 1: Drop the existing PRIMARY KEY constraint
ALTER TABLE tour_tags 
DROP CONSTRAINT IF EXISTS tour_tags_pkey;

-- Step 2: Make tag_id nullable (if it's not already)
ALTER TABLE tour_tags 
ALTER COLUMN tag_id DROP NOT NULL;

-- Step 3: Add interest_id column if it doesn't exist
ALTER TABLE tour_tags 
ADD COLUMN IF NOT EXISTS interest_id UUID REFERENCES interests(id) ON DELETE CASCADE;

-- Step 4: Create index for interest_id
CREATE INDEX IF NOT EXISTS idx_tour_tags_interest_id ON tour_tags(interest_id);

-- Step 5: Add check constraint to ensure either tag_id or interest_id is set (but not both)
ALTER TABLE tour_tags
DROP CONSTRAINT IF EXISTS tour_tags_tag_or_interest_check;

ALTER TABLE tour_tags
ADD CONSTRAINT tour_tags_tag_or_interest_check 
CHECK (
  (tag_id IS NOT NULL AND interest_id IS NULL) OR 
  (tag_id IS NULL AND interest_id IS NOT NULL)
);

-- Step 6: Add unique indexes to ensure uniqueness for both tag_id and interest_id cases
-- These partial indexes ensure that we can't have duplicate (tour_id, tag_id) or (tour_id, interest_id)
CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_tag 
ON tour_tags(tour_id, tag_id) 
WHERE tag_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_interest 
ON tour_tags(tour_id, interest_id) 
WHERE interest_id IS NOT NULL;

-- Step 7: Add a composite unique index for tour_id (for general uniqueness)
-- This ensures we don't have duplicate rows
CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_composite
ON tour_tags(tour_id, COALESCE(tag_id::text, ''), COALESCE(interest_id::text, ''))
WHERE (tag_id IS NOT NULL OR interest_id IS NOT NULL);




