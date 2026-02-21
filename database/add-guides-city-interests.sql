-- ============================================================================
-- ADD city AND interests COLUMNS TO guides TABLE
-- ============================================================================
-- These fields allow guides to specify their city and interests
-- which will be displayed in the "About the Author" section on tour pages.
-- ============================================================================

DO $$
BEGIN
  -- Add city column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guides' 
    AND column_name = 'city'
  ) THEN
    ALTER TABLE guides ADD COLUMN city VARCHAR(255);
    RAISE NOTICE '✅ Added city column to guides table';
  ELSE
    RAISE NOTICE 'ℹ️ city column already exists in guides table';
  END IF;

  -- Add interests column if it doesn't exist
  -- Stored as TEXT (comma-separated values for simplicity)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guides' 
    AND column_name = 'interests'
  ) THEN
    ALTER TABLE guides ADD COLUMN interests TEXT;
    RAISE NOTICE '✅ Added interests column to guides table';
  ELSE
    RAISE NOTICE 'ℹ️ interests column already exists in guides table';
  END IF;
END $$;

-- Verify columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'guides'
  AND column_name IN ('city', 'interests')
ORDER BY column_name;
