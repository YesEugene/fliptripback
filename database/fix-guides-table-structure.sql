-- Fix guides table structure
-- This script checks and fixes the guides table to match the expected structure
-- Option 1: If table uses user_id, we need to migrate to id
-- Option 2: If table uses id but missing avatar_url, we add it

-- First, let's check if avatar_url column exists, if not add it
DO $$
BEGIN
  -- Check if avatar_url column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guides' 
    AND column_name = 'avatar_url'
  ) THEN
    -- Add avatar_url column
    ALTER TABLE guides ADD COLUMN avatar_url TEXT;
    RAISE NOTICE 'Added avatar_url column to guides table';
  ELSE
    RAISE NOTICE 'avatar_url column already exists';
  END IF;
END $$;

-- Check if table uses user_id or id as primary key
-- If it uses user_id, we need to understand the current structure
-- Note: We're keeping user_id for now if it exists, but the code should use id = user_id

-- Verify the structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'guides'
ORDER BY ordinal_position;



