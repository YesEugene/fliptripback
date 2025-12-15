-- Migration: Update Health and Unique Experiences interests
-- Update interest names to match user requirements

DO $$
DECLARE
  health_id UUID;
  unique_id UUID;
  relaxation_id UUID;
  events_id UUID;
BEGIN
  -- Get category IDs
  SELECT id INTO health_id FROM interest_categories WHERE name = 'health';
  SELECT id INTO unique_id FROM interest_categories WHERE name = 'unique';
  SELECT id INTO relaxation_id FROM interest_subcategories WHERE category_id = health_id AND name = 'relaxation' LIMIT 1;
  SELECT id INTO events_id FROM interest_subcategories WHERE category_id = unique_id AND name = 'events' LIMIT 1;

  -- Update HEALTH category interests
  -- Update existing interests to match user requirements
  UPDATE interests 
  SET name = 'spa salons'
  WHERE category_id = health_id AND subcategory_id = relaxation_id AND name = 'spa salons';
  
  UPDATE interests 
  SET name = 'yoga'
  WHERE category_id = health_id AND subcategory_id = relaxation_id AND name = 'yoga';
  
  UPDATE interests 
  SET name = 'hot springs'
  WHERE category_id = health_id AND subcategory_id = relaxation_id AND name = 'hot springs';

  -- Ensure all required interests exist for Health → Relaxation
  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    (health_id, relaxation_id, 'spa salons', 1),
    (health_id, relaxation_id, 'yoga', 2),
    (health_id, relaxation_id, 'hot springs', 3)
  ON CONFLICT DO NOTHING;

  -- Update UNIQUE category interests
  -- Update existing interests to match user requirements
  UPDATE interests 
  SET name = 'music festivals'
  WHERE category_id = unique_id AND subcategory_id = events_id AND name = 'music festivals';
  
  UPDATE interests 
  SET name = 'local festivals'
  WHERE category_id = unique_id AND subcategory_id = events_id AND name = 'local festivals';
  
  UPDATE interests 
  SET name = 'conferences'
  WHERE category_id = unique_id AND subcategory_id = events_id AND name = 'conferences';

  -- Ensure all required interests exist for Unique → Events
  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    (unique_id, events_id, 'music festivals', 1),
    (unique_id, events_id, 'local festivals', 2),
    (unique_id, events_id, 'conferences', 3)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Successfully updated Health and Unique Experiences interests';
END $$;

