-- Fix tours_status_check constraint
-- Step 1: First, fix any invalid status values in existing rows
-- Step 2: Then drop and recreate the constraint

-- Step 1: Update any invalid or NULL status values to 'draft'
UPDATE tours 
SET status = 'draft' 
WHERE status IS NULL 
   OR status NOT IN ('draft', 'pending', 'approved', 'rejected');

-- Step 2: If status column doesn't exist yet, add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tours' AND column_name = 'status'
    ) THEN
        ALTER TABLE tours 
        ADD COLUMN status VARCHAR(20) DEFAULT 'draft' NOT NULL;
        
        -- Set existing published tours to 'approved'
        UPDATE tours 
        SET status = 'approved' 
        WHERE is_published = true;
        
        -- Set existing unpublished tours to 'draft'
        UPDATE tours 
        SET status = 'draft' 
        WHERE is_published = false OR is_published IS NULL;
        
        RAISE NOTICE 'Column status added successfully';
    ELSE
        RAISE NOTICE 'Column status already exists';
    END IF;
END $$;

-- Step 3: Ensure all status values are valid before creating constraint
UPDATE tours 
SET status = 'draft' 
WHERE status IS NULL 
   OR status NOT IN ('draft', 'pending', 'approved', 'rejected');

-- Step 4: Drop the existing constraint if it exists (with wrong values)
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

-- Step 5: Add the correct constraint with all valid status values
ALTER TABLE tours 
ADD CONSTRAINT tours_status_check 
CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

-- Step 6: Verify the constraint was created
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
