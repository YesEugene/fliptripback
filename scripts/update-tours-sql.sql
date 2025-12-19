-- SQL Script to Update Tours with Full Day Plans
-- Run this in Supabase SQL Editor
-- This script will update existing tours or create new ones with complete day plans

-- First, let's see what tours exist
SELECT id, title, city_id, duration_value FROM tours LIMIT 20;

-- Note: This is a template. You'll need to:
-- 1. Get city IDs first
-- 2. Get or create tag IDs
-- 3. Update tours one by one
-- 4. Delete old tour_days, tour_blocks, tour_items
-- 5. Insert new structure

-- Example for Paris tour:
-- Step 1: Get Paris city ID
-- SELECT id FROM cities WHERE name ILIKE 'Paris' LIMIT 1;

-- Step 2: Update tour
-- UPDATE tours 
-- SET description = 'A charming two-day journey through the romantic streets of Paris...',
--     duration_value = 2
-- WHERE title ILIKE 'Romantic Weekend in Paris';

-- Step 3: Delete old structure (get tour_id first)
-- DELETE FROM tour_items WHERE tour_block_id IN (
--   SELECT id FROM tour_blocks WHERE tour_day_id IN (
--     SELECT id FROM tour_days WHERE tour_id = 'YOUR_TOUR_ID'
--   )
-- );
-- DELETE FROM tour_blocks WHERE tour_day_id IN (
--   SELECT id FROM tour_days WHERE tour_id = 'YOUR_TOUR_ID'
-- );
-- DELETE FROM tour_days WHERE tour_id = 'YOUR_TOUR_ID';

-- Then insert new structure...

-- This is complex, so better to use the API endpoint when it works
-- Or use the Node.js script below



