-- Migration: Interests System (3-level hierarchy)
-- Replaces simple tags with hierarchical interests system

-- ============================================
-- INTERESTS SYSTEM TABLES
-- ============================================

-- Level 1: Top-level interest categories
CREATE TABLE IF NOT EXISTS interest_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL, -- 'active', 'culture', 'food', 'nature', 'nightlife', 'family', 'romantic'
  icon VARCHAR(50), -- for UI icons
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Level 2: Subcategories (e.g., "Active → Winter Sports")
CREATE TABLE IF NOT EXISTS interest_subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES interest_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- 'winter sports', 'water sports', 'museums', 'art galleries'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- Level 3: Specific interests (e.g., "Active → Winter Sports → Skiing")
CREATE TABLE IF NOT EXISTS interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES interest_categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES interest_subcategories(id) ON DELETE SET NULL, -- Can be null for direct category interests
  name VARCHAR(100) NOT NULL, -- 'skiing', 'cycling', 'museums', 'art galleries'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index for interests (handles NULL subcategory_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_interests_unique ON interests(
  category_id, 
  COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  name
);

-- City-Interests mapping (for future use - which interests are available in which cities)
CREATE TABLE IF NOT EXISTS city_interests (
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,
  popularity_score INTEGER DEFAULT 0, -- For future: sorting by popularity
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (city_id, interest_id)
);

-- Location-Interests mapping (replaces location_tags)
CREATE TABLE IF NOT EXISTS location_interests (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,
  relevance_score INTEGER DEFAULT 5 CHECK (relevance_score BETWEEN 1 AND 10), -- How relevant is this location for this interest
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (location_id, interest_id)
);

-- Tour-Interests mapping (replaces tour_tags)
CREATE TABLE IF NOT EXISTS tour_interests (
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (tour_id, interest_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_interests_category ON interests(category_id);
CREATE INDEX IF NOT EXISTS idx_interests_subcategory ON interests(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_location_interests_location ON location_interests(location_id);
CREATE INDEX IF NOT EXISTS idx_location_interests_interest ON location_interests(interest_id);
CREATE INDEX IF NOT EXISTS idx_tour_interests_tour ON tour_interests(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_interests_interest ON tour_interests(interest_id);
CREATE INDEX IF NOT EXISTS idx_city_interests_city ON city_interests(city_id);

-- ============================================
-- SEED DATA: Initial Interest Categories and Interests
-- ============================================

-- Insert top-level categories
INSERT INTO interest_categories (name, icon, display_order) VALUES
  ('active', '🏃', 1),
  ('culture', '🏛️', 2),
  ('food', '🍽️', 3),
  ('nature', '🌳', 4),
  ('nightlife', '🍸', 5),
  ('family', '👨‍👩‍👧', 6),
  ('romantic', '💑', 7)
ON CONFLICT (name) DO NOTHING;

-- Insert subcategories and interests
-- Note: We'll use a CTE to get category IDs first
DO $$
DECLARE
  active_id UUID;
  culture_id UUID;
  food_id UUID;
  nature_id UUID;
  nightlife_id UUID;
  family_id UUID;
  romantic_id UUID;
  
  winter_sports_id UUID;
  water_sports_id UUID;
  land_sports_id UUID;
  museums_id UUID;
  art_id UUID;
  entertainment_id UUID;
  restaurants_id UUID;
  cafes_id UUID;
  experiences_id UUID;
  parks_id UUID;
  beaches_id UUID;
  mountains_id UUID;
  bars_id UUID;
  clubs_id UUID;
  activities_id UUID;
  attractions_id UUID;
  experiences_romantic_id UUID;
BEGIN
  -- Get category IDs
  SELECT id INTO active_id FROM interest_categories WHERE name = 'active';
  SELECT id INTO culture_id FROM interest_categories WHERE name = 'culture';
  SELECT id INTO food_id FROM interest_categories WHERE name = 'food';
  SELECT id INTO nature_id FROM interest_categories WHERE name = 'nature';
  SELECT id INTO nightlife_id FROM interest_categories WHERE name = 'nightlife';
  SELECT id INTO family_id FROM interest_categories WHERE name = 'family';
  SELECT id INTO romantic_id FROM interest_categories WHERE name = 'romantic';

  -- ACTIVE category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (active_id, 'winter sports', 1),
    (active_id, 'water sports', 2),
    (active_id, 'land sports', 3),
    (active_id, 'adventure', 4)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO winter_sports_id FROM interest_subcategories WHERE category_id = active_id AND name = 'winter sports' LIMIT 1;
  SELECT id INTO water_sports_id FROM interest_subcategories WHERE category_id = active_id AND name = 'water sports' LIMIT 1;
  SELECT id INTO land_sports_id FROM interest_subcategories WHERE category_id = active_id AND name = 'land sports' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Active → Winter Sports
    (active_id, winter_sports_id, 'skiing', 1),
    (active_id, winter_sports_id, 'snowboarding', 2),
    (active_id, winter_sports_id, 'ice skating', 3),
    -- Active → Water Sports
    (active_id, water_sports_id, 'swimming', 4),
    (active_id, water_sports_id, 'surfing', 5),
    (active_id, water_sports_id, 'diving', 6),
    (active_id, water_sports_id, 'sailing', 7),
    -- Active → Land Sports
    (active_id, land_sports_id, 'cycling', 8),
    (active_id, land_sports_id, 'running', 9),
    (active_id, land_sports_id, 'hiking', 10),
    (active_id, land_sports_id, 'climbing', 11),
    -- Active → Adventure (direct, no subcategory)
    (active_id, NULL, 'adventure sports', 12),
    (active_id, NULL, 'extreme sports', 13)
  ON CONFLICT DO NOTHING;

  -- CULTURE category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (culture_id, 'museums', 1),
    (culture_id, 'art', 2),
    (culture_id, 'entertainment', 3),
    (culture_id, 'history', 4)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO museums_id FROM interest_subcategories WHERE category_id = culture_id AND name = 'museums' LIMIT 1;
  SELECT id INTO art_id FROM interest_subcategories WHERE category_id = culture_id AND name = 'art' LIMIT 1;
  SELECT id INTO entertainment_id FROM interest_subcategories WHERE category_id = culture_id AND name = 'entertainment' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Culture → Museums
    (culture_id, museums_id, 'history museums', 1),
    (culture_id, museums_id, 'art museums', 2),
    (culture_id, museums_id, 'science museums', 3),
    (culture_id, museums_id, 'specialty museums', 4),
    -- Culture → Art
    (culture_id, art_id, 'art galleries', 5),
    (culture_id, art_id, 'street art', 6),
    (culture_id, art_id, 'sculpture', 7),
    -- Culture → Entertainment
    (culture_id, entertainment_id, 'theaters', 8),
    (culture_id, entertainment_id, 'concerts', 9),
    (culture_id, entertainment_id, 'opera', 10),
    (culture_id, entertainment_id, 'ballet', 11),
    -- Culture → History (direct)
    (culture_id, NULL, 'historical sites', 12),
    (culture_id, NULL, 'monuments', 13),
    (culture_id, NULL, 'churches', 14),
    (culture_id, NULL, 'castles', 15)
  ON CONFLICT DO NOTHING;

  -- FOOD category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (food_id, 'restaurants', 1),
    (food_id, 'cafes', 2),
    (food_id, 'experiences', 3)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO restaurants_id FROM interest_subcategories WHERE category_id = food_id AND name = 'restaurants' LIMIT 1;
  SELECT id INTO cafes_id FROM interest_subcategories WHERE category_id = food_id AND name = 'cafes' LIMIT 1;
  SELECT id INTO experiences_id FROM interest_subcategories WHERE category_id = food_id AND name = 'experiences' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Food → Restaurants
    (food_id, restaurants_id, 'fine dining', 1),
    (food_id, restaurants_id, 'local cuisine', 2),
    (food_id, restaurants_id, 'street food', 3),
    (food_id, restaurants_id, 'seafood', 4),
    -- Food → Cafes
    (food_id, cafes_id, 'coffee shops', 5),
    (food_id, cafes_id, 'tea houses', 6),
    (food_id, cafes_id, 'pastry shops', 7),
    -- Food → Experiences
    (food_id, experiences_id, 'food tours', 8),
    (food_id, experiences_id, 'cooking classes', 9),
    (food_id, experiences_id, 'wine tasting', 10),
    (food_id, experiences_id, 'markets', 11)
  ON CONFLICT DO NOTHING;

  -- NATURE category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (nature_id, 'parks', 1),
    (nature_id, 'beaches', 2),
    (nature_id, 'mountains', 3)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO parks_id FROM interest_subcategories WHERE category_id = nature_id AND name = 'parks' LIMIT 1;
  SELECT id INTO beaches_id FROM interest_subcategories WHERE category_id = nature_id AND name = 'beaches' LIMIT 1;
  SELECT id INTO mountains_id FROM interest_subcategories WHERE category_id = nature_id AND name = 'mountains' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Nature → Parks
    (nature_id, parks_id, 'city parks', 1),
    (nature_id, parks_id, 'national parks', 2),
    (nature_id, parks_id, 'botanical gardens', 3),
    -- Nature → Beaches
    (nature_id, beaches_id, 'beaches', 4),
    (nature_id, beaches_id, 'beach clubs', 5),
    -- Nature → Mountains
    (nature_id, mountains_id, 'mountain views', 6),
    (nature_id, mountains_id, 'hiking trails', 7),
    -- Nature (direct)
    (nature_id, NULL, 'waterfalls', 8),
    (nature_id, NULL, 'lakes', 9),
    (nature_id, NULL, 'forests', 10)
  ON CONFLICT DO NOTHING;

  -- NIGHTLIFE category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (nightlife_id, 'bars', 1),
    (nightlife_id, 'clubs', 2)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO bars_id FROM interest_subcategories WHERE category_id = nightlife_id AND name = 'bars' LIMIT 1;
  SELECT id INTO clubs_id FROM interest_subcategories WHERE category_id = nightlife_id AND name = 'clubs' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Nightlife → Bars
    (nightlife_id, bars_id, 'cocktail bars', 1),
    (nightlife_id, bars_id, 'wine bars', 2),
    (nightlife_id, bars_id, 'beer bars', 3),
    (nightlife_id, bars_id, 'rooftop bars', 4),
    -- Nightlife → Clubs
    (nightlife_id, clubs_id, 'nightclubs', 5),
    (nightlife_id, clubs_id, 'dance clubs', 6),
    -- Nightlife (direct)
    (nightlife_id, NULL, 'live music', 7),
    (nightlife_id, NULL, 'jazz clubs', 8),
    (nightlife_id, NULL, 'casinos', 9)
  ON CONFLICT DO NOTHING;

  -- FAMILY category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (family_id, 'activities', 1),
    (family_id, 'attractions', 2)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO activities_id FROM interest_subcategories WHERE category_id = family_id AND name = 'activities' LIMIT 1;
  SELECT id INTO attractions_id FROM interest_subcategories WHERE category_id = family_id AND name = 'attractions' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Family → Activities
    (family_id, activities_id, 'theme parks', 1),
    (family_id, activities_id, 'amusement parks', 2),
    (family_id, activities_id, 'water parks', 3),
    -- Family → Attractions
    (family_id, attractions_id, 'zoos', 4),
    (family_id, attractions_id, 'aquariums', 5),
    (family_id, attractions_id, 'planetariums', 6),
    -- Family (direct)
    (family_id, NULL, 'family beaches', 7),
    (family_id, NULL, 'playgrounds', 8)
  ON CONFLICT DO NOTHING;

  -- ROMANTIC category
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (romantic_id, 'experiences', 1)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  SELECT id INTO experiences_romantic_id FROM interest_subcategories WHERE category_id = romantic_id AND name = 'experiences' LIMIT 1;

  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    -- Romantic → Experiences
    (romantic_id, experiences_romantic_id, 'sunset spots', 1),
    (romantic_id, experiences_romantic_id, 'romantic dinners', 2),
    (romantic_id, experiences_romantic_id, 'wine tours', 3),
    -- Romantic (direct)
    (romantic_id, NULL, 'romantic gardens', 4),
    (romantic_id, NULL, 'spas', 5),
    (romantic_id, NULL, 'couples activities', 6)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- Old tables (tags, location_tags, tour_tags) will be kept for backward compatibility
-- New code should use interests system
-- Migration script can be created later to convert existing tags to interests

