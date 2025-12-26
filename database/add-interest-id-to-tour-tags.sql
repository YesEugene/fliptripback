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

-- Update primary key to include interest_id for uniqueness
-- Note: We need to drop the existing primary key first if it exists
ALTER TABLE tour_tags
DROP CONSTRAINT IF EXISTS tour_tags_pkey;

-- Create new composite primary key that works with both tag_id and interest_id
-- We'll use a unique constraint instead since we can't have a single PK for both cases
ALTER TABLE tour_tags
ADD CONSTRAINT tour_tags_pkey PRIMARY KEY (tour_id, COALESCE(tag_id, interest_id));

-- Alternative: Use a unique constraint if the above doesn't work
-- ALTER TABLE tour_tags
-- ADD CONSTRAINT tour_tags_unique UNIQUE (tour_id, COALESCE(tag_id, interest_id));

