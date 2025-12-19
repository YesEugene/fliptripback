-- Migration: Add status field to tours table for draft/moderation system
-- Status values: 'draft', 'pending', 'approved', 'rejected'

-- Add status column if it doesn't exist
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
        
        -- Add check constraint to ensure valid status values
        ALTER TABLE tours 
        ADD CONSTRAINT tours_status_check 
        CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));
        
        -- Add index for faster filtering
        CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);
        
        RAISE NOTICE 'Column status added successfully';
    ELSE
        RAISE NOTICE 'Column status already exists';
    END IF;
END $$;

-- Add moderation_comment column for rejection comments
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tours' AND column_name = 'moderation_comment'
    ) THEN
        ALTER TABLE tours 
        ADD COLUMN moderation_comment TEXT;
        
        RAISE NOTICE 'Column moderation_comment added successfully';
    ELSE
        RAISE NOTICE 'Column moderation_comment already exists';
    END IF;
END $$;


