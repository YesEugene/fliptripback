-- Migration: Add 'map' to allowed block_type values in tour_content_blocks
-- This fixes the constraint violation error when creating map blocks

-- Step 1: Drop the existing check constraint
ALTER TABLE tour_content_blocks 
DROP CONSTRAINT IF EXISTS tour_content_blocks_block_type_check;

-- Step 2: Add the new constraint with 'map' included
ALTER TABLE tour_content_blocks 
ADD CONSTRAINT tour_content_blocks_block_type_check 
CHECK (block_type IN (
  'location',
  'title', 
  'photo_text',
  'text',
  'slide',
  '3columns',
  'photo',
  'divider',
  'map'  -- New block type for map visualization
));

-- Verify the constraint
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully added ''map'' to allowed block_type values';
  RAISE NOTICE '📍 Allowed block types: location, title, photo_text, text, slide, 3columns, photo, divider, map';
END $$;

