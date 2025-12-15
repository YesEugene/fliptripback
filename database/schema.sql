-- FlipTrip Database Schema
-- PostgreSQL for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'guide', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Guides table (extends users for guide-specific data)
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  bio TEXT,
  avatar TEXT,
  instagram VARCHAR(255),
  facebook VARCHAR(255),
  twitter VARCHAR(255),
  linkedin VARCHAR(255),
  website VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  code VARCHAR(2) UNIQUE, -- ISO country code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country_id, name)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'interest' CHECK (type IN ('interest', 'mood', 'format', 'category', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations table (verified locations database)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  google_place_id VARCHAR(255),
  category VARCHAR(100), -- restaurant, museum, bar, park, etc.
  description TEXT,
  recommendations TEXT,
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 4), -- 1=cheap, 4=expensive
  avg_price_usd DECIMAL(10, 2),
  website TEXT,
  phone VARCHAR(50),
  booking_url TEXT, -- For "Reserve Table" button
  verified BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'admin' CHECK (source IN ('admin', 'guide', 'import', 'ai', 'google')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Location photos table
CREATE TABLE IF NOT EXISTS location_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'google',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location tags junction table
CREATE TABLE IF NOT EXISTS location_tags (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, tag_id)
);

-- ============================================
-- TOURS TABLES
-- ============================================

-- Tours table
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE,
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  preview_media_url TEXT,
  preview_media_type VARCHAR(20) DEFAULT 'image' CHECK (preview_media_type IN ('image', 'video')),
  duration_type VARCHAR(20) DEFAULT 'hours' CHECK (duration_type IN ('hours', 'days')),
  duration_value INTEGER NOT NULL,
  languages TEXT[] DEFAULT ARRAY['en'],
  default_format VARCHAR(50) DEFAULT 'self_guided' CHECK (default_format IN ('self_guided', 'with_guide', 'both')),
  price_pdf DECIMAL(10, 2) DEFAULT 16.00,
  price_guided DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  meeting_point TEXT,
  meeting_time TIME,
  available_dates DATE[],
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tour days table
CREATE TABLE IF NOT EXISTS tour_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title VARCHAR(255),
  date_hint VARCHAR(100), -- e.g., "Day 1", "Morning", etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_id, day_number)
);

-- Tour blocks table (time blocks within a day)
CREATE TABLE IF NOT EXISTS tour_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_day_id UUID REFERENCES tour_days(id) ON DELETE CASCADE,
  start_time TIME,
  end_time TIME,
  title VARCHAR(255),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tour items table (locations/activities within a block)
CREATE TABLE IF NOT EXISTS tour_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_block_id UUID REFERENCES tour_blocks(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL, -- Can be null for custom items
  custom_title VARCHAR(255), -- Override location name if needed
  custom_description TEXT, -- Override location description
  custom_recommendations TEXT, -- Override location recommendations
  order_index INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  approx_cost DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tour tags junction table
CREATE TABLE IF NOT EXISTS tour_tags (
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (tour_id, tag_id)
);

-- Tour additional options (platform and creator options)
CREATE TABLE IF NOT EXISTS tour_additional_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  option_type VARCHAR(50) NOT NULL CHECK (option_type IN ('platform', 'creator')),
  option_key VARCHAR(100) NOT NULL, -- 'insurance', 'accommodation', 'photography', 'food', 'transport'
  option_price DECIMAL(10, 2) DEFAULT 0,
  UNIQUE(tour_id, option_type, option_key)
);

-- ============================================
-- ITINERARIES (Generated plans for users)
-- ============================================

-- Itineraries table (generated plans for specific users)
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Can be null for anonymous
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  title VARCHAR(255),
  subtitle VARCHAR(255),
  description TEXT,
  interests TEXT[],
  audience VARCHAR(50),
  budget DECIMAL(10, 2),
  tour_date DATE,
  preview_only BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  payment_session_id VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Itinerary items (locations in generated itinerary)
CREATE TABLE IF NOT EXISTS itinerary_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  tour_item_id UUID REFERENCES tour_items(id) ON DELETE SET NULL, -- If from a guide tour
  day_number INTEGER,
  block_time VARCHAR(50), -- e.g., "09:00 - 12:00"
  order_index INTEGER DEFAULT 0,
  title VARCHAR(255),
  description TEXT,
  recommendations TEXT,
  category VARCHAR(100),
  duration_minutes INTEGER,
  approx_cost DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAYMENTS & ANALYTICS
-- ============================================

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- AUDIT LOG (for admin tracking)
-- ============================================

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'tour', 'location', 'user', etc.
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Locations indexes
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city_id);
CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_verified ON locations(verified);
CREATE INDEX IF NOT EXISTS idx_locations_google_place_id ON locations(google_place_id);

-- Tours indexes
CREATE INDEX IF NOT EXISTS idx_tours_guide ON tours(guide_id);
CREATE INDEX IF NOT EXISTS idx_tours_city ON tours(city_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_published ON tours(is_published);

-- Itineraries indexes
CREATE INDEX IF NOT EXISTS idx_itineraries_user ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_city ON itineraries(city_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_created ON itineraries(created_at);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON guides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON itineraries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (optional seed data)
-- ============================================

-- Insert some common countries
INSERT INTO countries (name, code) VALUES
  ('France', 'FR'),
  ('Italy', 'IT'),
  ('Spain', 'ES'),
  ('Portugal', 'PT'),
  ('Germany', 'DE'),
  ('United Kingdom', 'GB'),
  ('United States', 'US')
ON CONFLICT (name) DO NOTHING;

-- Insert some common cities
INSERT INTO cities (country_id, name, lat, lng) 
SELECT c.id, city_data.name, city_data.lat, city_data.lng
FROM (VALUES
  ('France', 'Paris', 48.8566, 2.3522),
  ('Italy', 'Rome', 41.9028, 12.4964),
  ('Italy', 'Milan', 45.4642, 9.1900),
  ('Spain', 'Barcelona', 41.3851, 2.1734),
  ('Spain', 'Madrid', 40.4168, -3.7038),
  ('Portugal', 'Lisbon', 38.7223, -9.1393),
  ('United Kingdom', 'London', 51.5074, -0.1278),
  ('United States', 'New York', 40.7128, -74.0060)
) AS city_data(country_name, name, lat, lng)
JOIN countries c ON c.name = city_data.country_name
ON CONFLICT (country_id, name) DO NOTHING;

-- Insert common tags
INSERT INTO tags (name, type) VALUES
  ('adventure', 'interest'),
  ('romance', 'interest'),
  ('culture', 'interest'),
  ('food', 'interest'),
  ('nightlife', 'interest'),
  ('nature', 'interest'),
  ('architecture', 'interest'),
  ('history', 'interest'),
  ('art', 'interest'),
  ('shopping', 'interest'),
  ('relaxation', 'mood'),
  ('active', 'mood'),
  ('luxury', 'mood'),
  ('budget', 'mood')
ON CONFLICT (name) DO NOTHING;

