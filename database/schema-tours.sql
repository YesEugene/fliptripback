-- Нормализованная структура для туров согласно плану
-- tours → tour_days → tour_blocks → tour_items

-- 1. Таблица туров (основная)
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES users(id) ON DELETE CASCADE, -- FK к users (role='creator')
  title VARCHAR(255) NOT NULL,
  description TEXT,
  country VARCHAR(100),
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  duration_type VARCHAR(20) CHECK (duration_type IN ('hours', 'days')),
  duration_value INTEGER,
  default_format VARCHAR(50) DEFAULT 'self_guided', -- self_guided, with_guide
  price_pdf DECIMAL(10,2) DEFAULT 16.00,
  price_guided DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  preview_media_url TEXT,
  preview_media_type VARCHAR(20) CHECK (preview_media_type IN ('image', 'video')),
  is_published BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Таблица дней тура
CREATE TABLE IF NOT EXISTS tour_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title VARCHAR(255),
  date_hint DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица блоков дня (утро/день/вечер)
CREATE TABLE IF NOT EXISTS tour_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_day_id UUID REFERENCES tour_days(id) ON DELETE CASCADE,
  start_time TIME,
  end_time TIME,
  title VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица элементов блока (конкретные локации)
CREATE TABLE IF NOT EXISTS tour_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_block_id UUID REFERENCES tour_blocks(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL, -- FK к locations!
  custom_title VARCHAR(255), -- Если гид хочет назвать иначе
  custom_description TEXT,
  custom_recommendations TEXT,
  order_index INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  approx_cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Связь туров с тегами
CREATE TABLE IF NOT EXISTS tour_tags (
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (tour_id, tag_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_tours_guide_id ON tours(guide_id);
CREATE INDEX IF NOT EXISTS idx_tours_city_id ON tours(city_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);
CREATE INDEX IF NOT EXISTS idx_tour_days_tour_id ON tour_days(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_blocks_tour_day_id ON tour_blocks(tour_day_id);
CREATE INDEX IF NOT EXISTS idx_tour_items_tour_block_id ON tour_items(tour_block_id);
CREATE INDEX IF NOT EXISTS idx_tour_items_location_id ON tour_items(location_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

