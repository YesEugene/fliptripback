-- Add meta JSONB field to tours table for storing additional data
-- This field will store: meeting_point, meeting_time, available_dates, additional_options

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tours' AND column_name = 'meta'
    ) THEN
        ALTER TABLE tours 
        ADD COLUMN meta JSONB DEFAULT '{}'::jsonb;
        
        RAISE NOTICE 'Column meta added successfully';
    ELSE
        RAISE NOTICE 'Column meta already exists';
    END IF;
END $$;

-- Add index for faster queries on meta field
CREATE INDEX IF NOT EXISTS idx_tours_meta ON tours USING GIN (meta);

-- Add comment
COMMENT ON COLUMN tours.meta IS 'Additional tour data: meeting_point, meeting_time, available_dates, additional_options';


