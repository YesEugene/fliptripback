-- ============================================================================
-- ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ПОЛЕЙ В ТАБЛИЦУ LOCATIONS
-- ============================================================================
-- Этот скрипт можно безопасно выполнять несколько раз (idempotent)
-- Выполните его в Supabase Dashboard → SQL Editor
-- ============================================================================

DO $$
BEGIN
  -- Добавляем website (сайт локации)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'website'
  ) THEN
    ALTER TABLE locations ADD COLUMN website VARCHAR(500);
    RAISE NOTICE '✅ Добавлена колонка website';
  END IF;

  -- Добавляем phone (телефон локации)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'phone'
  ) THEN
    ALTER TABLE locations ADD COLUMN phone VARCHAR(50);
    RAISE NOTICE '✅ Добавлена колонка phone';
  END IF;

  -- Добавляем booking_url (ссылка для бронирования)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'booking_url'
  ) THEN
    ALTER TABLE locations ADD COLUMN booking_url VARCHAR(500);
    RAISE NOTICE '✅ Добавлена колонка booking_url';
  END IF;

  -- Добавляем price_level (уровень цен: 0=бесплатно, 1=дешево, 2=средне, 3=дорого, 4=очень дорого)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'price_level'
  ) THEN
    ALTER TABLE locations ADD COLUMN price_level INTEGER CHECK (price_level >= 0 AND price_level <= 4) DEFAULT 2;
    RAISE NOTICE '✅ Добавлена колонка price_level';
  END IF;

  -- Добавляем source (источник локации: admin, guide, import, ai)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'source'
  ) THEN
    ALTER TABLE locations ADD COLUMN source VARCHAR(50) CHECK (source IN ('admin', 'guide', 'import', 'ai', 'google')) DEFAULT 'admin';
    RAISE NOTICE '✅ Добавлена колонка source';
  END IF;

  -- Добавляем updated_by (кто последний раз обновил запись)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE locations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Добавлена колонка updated_by';
  END IF;

  -- Добавляем google_place_id (внешний ID из Google Places)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'google_place_id'
  ) THEN
    ALTER TABLE locations ADD COLUMN google_place_id VARCHAR(255);
    RAISE NOTICE '✅ Добавлена колонка google_place_id';
  END IF;

  -- Создаем индекс для google_place_id (для быстрого поиска)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'locations' AND indexname = 'idx_locations_google_place_id'
  ) THEN
    CREATE INDEX idx_locations_google_place_id ON locations(google_place_id);
    RAISE NOTICE '✅ Создан индекс idx_locations_google_place_id';
  END IF;

  -- Создаем индекс для source (для фильтрации)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'locations' AND indexname = 'idx_locations_source'
  ) THEN
    CREATE INDEX idx_locations_source ON locations(source);
    RAISE NOTICE '✅ Создан индекс idx_locations_source';
  END IF;

  -- Создаем индекс для price_level (для фильтрации)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'locations' AND indexname = 'idx_locations_price_level'
  ) THEN
    CREATE INDEX idx_locations_price_level ON locations(price_level);
    RAISE NOTICE '✅ Создан индекс idx_locations_price_level';
  END IF;

  RAISE NOTICE '✅ Все колонки добавлены успешно';
END $$;

-- Комментарии к новым колонкам
COMMENT ON COLUMN locations.website IS 'Официальный сайт локации';
COMMENT ON COLUMN locations.phone IS 'Контактный телефон локации';
COMMENT ON COLUMN locations.booking_url IS 'Ссылка для бронирования (например, для ресторанов)';
COMMENT ON COLUMN locations.price_level IS 'Уровень цен: 0=бесплатно, 1=дешево, 2=средне, 3=дорого, 4=очень дорого';
COMMENT ON COLUMN locations.source IS 'Источник локации: admin (создано админом), guide (создано гидом), import (импортировано), ai (сгенерировано AI), google (из Google Places)';
COMMENT ON COLUMN locations.updated_by IS 'ID пользователя, который последний раз обновил запись';
COMMENT ON COLUMN locations.google_place_id IS 'Внешний ID из Google Places API (для связи с Google)';

