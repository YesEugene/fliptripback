-- Migration: Add draft_data field to tours table for draft editing
-- This allows guides to edit tours without affecting the published version
-- Draft data is stored separately and only applied when submitted for moderation

-- Add draft_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tours' AND column_name = 'draft_data'
    ) THEN
        ALTER TABLE tours 
        ADD COLUMN draft_data JSONB;
        
        -- Add index for faster queries (optional, but helpful)
        CREATE INDEX IF NOT EXISTS idx_tours_draft_data ON tours USING GIN (draft_data) WHERE draft_data IS NOT NULL;
        
        RAISE NOTICE 'Column draft_data added successfully';
    ELSE
        RAISE NOTICE 'Column draft_data already exists';
    END IF;
END $$;

-- Add comment to document the field
COMMENT ON COLUMN tours.draft_data IS 'Stores draft version of tour data. When guide edits an approved tour, changes are saved here. Only applied to main tour fields when submitted for moderation.';

