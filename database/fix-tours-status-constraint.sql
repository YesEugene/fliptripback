-- Fix tours_status_check constraint
-- This script removes the old constraint (if it exists) and creates a new one with correct values

-- Drop the existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tours_status_check' 
        AND table_name = 'tours'
    ) THEN
        ALTER TABLE tours DROP CONSTRAINT tours_status_check;
        RAISE NOTICE 'Old tours_status_check constraint dropped';
    END IF;
END $$;

-- Add the correct constraint with all valid status values
ALTER TABLE tours 
ADD CONSTRAINT tours_status_check 
CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

-- Verify the constraint was created
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tours_status_check' 
        AND table_name = 'tours'
    ) THEN
        RAISE NOTICE 'tours_status_check constraint created successfully with values: draft, pending, approved, rejected';
    ELSE
        RAISE EXCEPTION 'Failed to create tours_status_check constraint';
    END IF;
END $$;

