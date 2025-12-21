-- ============================================================================
-- ПРИМЕНЕНИЕ НОРМАЛИЗОВАННОЙ СТРУКТУРЫ ТУРОВ
-- ============================================================================
-- Этот скрипт можно безопасно выполнять несколько раз (idempotent)
-- Выполните его в Supabase Dashboard → SQL Editor
-- ============================================================================

-- Шаг 1: Проверка и миграция существующей таблицы tours
DO $$
BEGIN
  -- Если таблица tours существует, но нет колонки guide_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tours') THEN
    RAISE NOTICE 'Таблица tours существует, проверяем колонки...';
    
    -- Проверяем, какая колонка используется для creator
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'creator_id') THEN
      -- Переименовываем creator_id в guide_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'guide_id') THEN
        ALTER TABLE tours RENAME COLUMN creator_id TO guide_id;
        RAISE NOTICE '✅ Переименована колонка creator_id → guide_id';
      END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'user_id') THEN
      -- Переименовываем user_id в guide_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'guide_id') THEN
        ALTER TABLE tours RENAME COLUMN user_id TO guide_id;
        RAISE NOTICE '✅ Переименована колонка user_id → guide_id';
      END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'created_by') THEN
      -- Переименовываем created_by в guide_id
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'guide_id') THEN
        ALTER TABLE tours RENAME COLUMN created_by TO guide_id;
        RAISE NOTICE '✅ Переименована колонка created_by → guide_id';
      END IF;
    END IF;
    
    -- Добавляем guide_id, если его нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'guide_id') THEN
      ALTER TABLE tours ADD COLUMN guide_id UUID REFERENCES users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Добавлена колонка guide_id';
    END IF;
    
    -- Добавляем новые колонки, если их нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'duration_type') THEN
      ALTER TABLE tours ADD COLUMN duration_type VARCHAR(20) CHECK (duration_type IN ('hours', 'days'));
      RAISE NOTICE '✅ Добавлена колонка duration_type';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'duration_value') THEN
      ALTER TABLE tours ADD COLUMN duration_value INTEGER;
      RAISE NOTICE '✅ Добавлена колонка duration_value';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'default_format') THEN
      ALTER TABLE tours ADD COLUMN default_format VARCHAR(50) DEFAULT 'self_guided';
      RAISE NOTICE '✅ Добавлена колонка default_format';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'price_pdf') THEN
      ALTER TABLE tours ADD COLUMN price_pdf DECIMAL(10,2) DEFAULT 16.00;
      RAISE NOTICE '✅ Добавлена колонка price_pdf';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'price_guided') THEN
      ALTER TABLE tours ADD COLUMN price_guided DECIMAL(10,2);
      RAISE NOTICE '✅ Добавлена колонка price_guided';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'currency') THEN
      ALTER TABLE tours ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
      RAISE NOTICE '✅ Добавлена колонка currency';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'preview_media_url') THEN
      ALTER TABLE tours ADD COLUMN preview_media_url TEXT;
      RAISE NOTICE '✅ Добавлена колонка preview_media_url';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'preview_media_type') THEN
      ALTER TABLE tours ADD COLUMN preview_media_type VARCHAR(20) CHECK (preview_media_type IN ('image', 'video'));
      RAISE NOTICE '✅ Добавлена колонка preview_media_type';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'is_published') THEN
      ALTER TABLE tours ADD COLUMN is_published BOOLEAN DEFAULT false;
      RAISE NOTICE '✅ Добавлена колонка is_published';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'status') THEN
      ALTER TABLE tours ADD COLUMN status VARCHAR(50) DEFAULT 'draft';
      RAISE NOTICE '✅ Добавлена колонка status';
    END IF;
  ELSE
    RAISE NOTICE 'Таблица tours не существует, будет создана';
  END IF;
END $$;

-- 1. Таблица туров (основная)
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  country VARCHAR(100),
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  duration_type VARCHAR(20) CHECK (duration_type IN ('hours', 'days')),
  duration_value INTEGER,
  default_format VARCHAR(50) DEFAULT 'self_guided',
  price_pdf DECIMAL(10,2) DEFAULT 16.00,
  price_guided DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  preview_media_url TEXT,
  preview_media_type VARCHAR(20) CHECK (preview_media_type IN ('image', 'video')),
  is_published BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'draft',
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
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  custom_title VARCHAR(255),
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

DROP TRIGGER IF EXISTS update_tours_updated_at ON tours;
CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Проверка результата
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ МИГРАЦИЯ ЗАВЕРШЕНА';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Созданы таблицы:';
  RAISE NOTICE '  - tours (с колонкой guide_id)';
  RAISE NOTICE '  - tour_days';
  RAISE NOTICE '  - tour_blocks';
  RAISE NOTICE '  - tour_items (с FK location_id)';
  RAISE NOTICE '  - tour_tags';
  RAISE NOTICE 'Созданы индексы и триггеры';
  RAISE NOTICE '============================================================================';
END $$;



