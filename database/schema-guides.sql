-- ============================================================================
-- ТАБЛИЦА GUIDES (Гиды/Креаторы туров)
-- ============================================================================
-- Расширенная информация о гидах, которые создают туры
-- Связана с таблицей users через FK
-- ============================================================================

-- Создаем таблицу guides
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Основная информация
  name VARCHAR(255),
  bio TEXT,
  avatar_url TEXT,
  
  -- Социальные сети и контакты
  website VARCHAR(500),
  instagram VARCHAR(255),
  facebook VARCHAR(255),
  twitter VARCHAR(255),
  linkedin VARCHAR(255),
  youtube VARCHAR(255),
  
  -- Дополнительная информация
  languages TEXT[], -- Массив языков, на которых говорит гид
  specialties TEXT[], -- Массив специализаций (например: ['history', 'food', 'art'])
  rating DECIMAL(3,2) DEFAULT 0.00, -- Средний рейтинг (0.00 - 5.00)
  total_reviews INTEGER DEFAULT 0, -- Количество отзывов
  
  -- Статус
  is_verified BOOLEAN DEFAULT false, -- Проверен ли гид администратором
  is_active BOOLEAN DEFAULT true, -- Активен ли профиль гида
  
  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_guides_user_id ON guides(user_id);
CREATE INDEX IF NOT EXISTS idx_guides_is_verified ON guides(is_verified);
CREATE INDEX IF NOT EXISTS idx_guides_is_active ON guides(is_active);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW
  EXECUTE FUNCTION update_guides_updated_at();

-- Комментарии к таблице и колонкам
COMMENT ON TABLE guides IS 'Расширенная информация о гидах/креаторах туров';
COMMENT ON COLUMN guides.user_id IS 'Связь с таблицей users (один к одному)';
COMMENT ON COLUMN guides.languages IS 'Массив языков, на которых говорит гид (например: ["ru", "en", "es"])';
COMMENT ON COLUMN guides.specialties IS 'Массив специализаций гида (например: ["history", "food", "art", "architecture"])';
COMMENT ON COLUMN guides.rating IS 'Средний рейтинг гида (0.00 - 5.00)';
COMMENT ON COLUMN guides.is_verified IS 'Проверен ли гид администратором';

