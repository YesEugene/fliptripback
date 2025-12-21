-- Fix default_format constraint in tours table
-- This script ensures the constraint allows 'self_guided' and 'with_guide' values

-- First, drop the existing constraint if it exists
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tours_default_format_check' 
    AND table_name = 'tours'
  ) THEN
    ALTER TABLE tours DROP CONSTRAINT tours_default_format_check;
    RAISE NOTICE '✅ Dropped existing tours_default_format_check constraint';
  END IF;
END $$;

-- Add the correct constraint that allows 'self_guided' and 'with_guide'
ALTER TABLE tours 
ADD CONSTRAINT tours_default_format_check 
CHECK (default_format IS NULL OR default_format IN ('self_guided', 'with_guide'));

-- Update any existing invalid values to 'self_guided'
UPDATE tours 
SET default_format = 'self_guided' 
WHERE default_format IS NOT NULL 
  AND default_format NOT IN ('self_guided', 'with_guide');

RAISE NOTICE '✅ Added tours_default_format_check constraint';
RAISE NOTICE '✅ Updated invalid default_format values to self_guided';



