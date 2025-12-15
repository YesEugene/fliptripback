-- Migration: Add description field to interest_categories and update Health/Unique categories
-- Add descriptions for Health and Unique categories

-- Add description column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interest_categories' AND column_name = 'description'
  ) THEN
    ALTER TABLE interest_categories ADD COLUMN description TEXT;
  END IF;
END $$;

-- Update Health category with description
UPDATE interest_categories 
SET description = 'Отдых, направленный на релаксацию, спа-процедуры, медитацию, йогу, термальные источники.'
WHERE name = 'health';

-- Update Unique category with description
UPDATE interest_categories 
SET description = 'Интересы, которые не входят в число других категорий: фестивали, мероприятия, посещение тематических парков, волонтёрство, хобби.'
WHERE name = 'unique';

-- Ensure Health → Relaxation subcategory exists
DO $$
DECLARE
  health_id UUID;
  relaxation_id UUID;
BEGIN
  SELECT id INTO health_id FROM interest_categories WHERE name = 'health';
  
  IF health_id IS NOT NULL THEN
    -- Insert subcategory if it doesn't exist
    INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
      (health_id, 'relaxation', 1)
    ON CONFLICT (category_id, name) DO NOTHING;
    
    SELECT id INTO relaxation_id FROM interest_subcategories WHERE category_id = health_id AND name = 'relaxation' LIMIT 1;
    
    -- Ensure interests exist
    INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
      (health_id, relaxation_id, 'spa salons', 1),
      (health_id, relaxation_id, 'yoga', 2),
      (health_id, relaxation_id, 'hot springs', 3)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Ensure Unique → Events subcategory exists
DO $$
DECLARE
  unique_id UUID;
  events_id UUID;
BEGIN
  SELECT id INTO unique_id FROM interest_categories WHERE name = 'unique';
  
  IF unique_id IS NOT NULL THEN
    -- Insert subcategory if it doesn't exist
    INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
      (unique_id, 'events', 1)
    ON CONFLICT (category_id, name) DO NOTHING;
    
    SELECT id INTO events_id FROM interest_subcategories WHERE category_id = unique_id AND name = 'events' LIMIT 1;
    
    -- Ensure interests exist
    INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
      (unique_id, events_id, 'music festivals', 1),
      (unique_id, events_id, 'local festivals', 2),
      (unique_id, events_id, 'conferences', 3)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

