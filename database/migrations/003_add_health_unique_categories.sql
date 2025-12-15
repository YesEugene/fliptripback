-- Migration: Add Health and Unique Experiences categories
-- Run this script to add new interest categories to existing database

DO $$
DECLARE
  health_id UUID;
  unique_id UUID;
  relaxation_id UUID;
  events_id UUID;
BEGIN
  -- Insert new categories
  INSERT INTO interest_categories (name, icon, display_order) VALUES
    ('health', '🧘', 8),
    ('unique', '🎪', 9)
  ON CONFLICT (name) DO NOTHING;

  -- Get category IDs
  SELECT id INTO health_id FROM interest_categories WHERE name = 'health';
  SELECT id INTO unique_id FROM interest_categories WHERE name = 'unique';

  -- HEALTH category: Add Relaxation subcategory
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (health_id, 'relaxation', 1)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO relaxation_id FROM interest_subcategories WHERE category_id = health_id AND name = 'relaxation' LIMIT 1;

  -- HEALTH: Add interests
  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Health → Relaxation
    (health_id, relaxation_id, 'spa salons', 1),
    (health_id, relaxation_id, 'yoga', 2),
    (health_id, relaxation_id, 'hot springs', 3),
    -- Health (direct)
    (health_id, NULL, 'meditation', 4),
    (health_id, NULL, 'wellness centers', 5),
    (health_id, NULL, 'thermal baths', 6)
  ON CONFLICT DO NOTHING;

  -- UNIQUE EXPERIENCES category: Add Events subcategory
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (unique_id, 'events', 1)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO events_id FROM interest_subcategories WHERE category_id = unique_id AND name = 'events' LIMIT 1;

  -- UNIQUE: Add interests
  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Unique → Events
    (unique_id, events_id, 'music festivals', 1),
    (unique_id, events_id, 'local festivals', 2),
    (unique_id, events_id, 'conferences', 3),
    -- Unique (direct)
    (unique_id, NULL, 'theme parks', 4),
    (unique_id, NULL, 'volunteering', 5),
    (unique_id, NULL, 'hobbies', 6),
    (unique_id, NULL, 'special events', 7)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Successfully added Health and Unique Experiences categories';
END $$;

