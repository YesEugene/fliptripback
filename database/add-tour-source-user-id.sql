-- ============================================================================
-- ДОБАВЛЕНИЕ ПОЛЕЙ source И user_id В ТАБЛИЦУ TOURS
-- ============================================================================
-- Этот скрипт можно безопасно выполнять несколько раз (idempotent)
-- Выполните его в Supabase Dashboard → SQL Editor
-- ============================================================================
-- 
-- Поля:
-- - source: источник тура ('guide', 'admin', 'user_generated')
--   - 'guide': тур создан гидом (существующие туры)
--   - 'admin': тур создан администратором
--   - 'user_generated': тур сгенерирован AI для пользователя (не показывается в поиске)
-- - user_id: ID пользователя, для которого создан тур (для user_generated туров)
-- ============================================================================

DO $$
BEGIN
  -- Добавляем source (источник тура)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tours' AND column_name = 'source'
  ) THEN
    ALTER TABLE tours ADD COLUMN source VARCHAR(50) 
    CHECK (source IN ('guide', 'admin', 'user_generated')) 
    DEFAULT NULL;
    RAISE NOTICE '✅ Добавлена колонка source';
  ELSE
    RAISE NOTICE 'ℹ️ Колонка source уже существует';
  END IF;

  -- Добавляем user_id (ID пользователя для user_generated туров)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tours' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE tours ADD COLUMN user_id UUID 
    REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Добавлена колонка user_id';
  ELSE
    RAISE NOTICE 'ℹ️ Колонка user_id уже существует';
  END IF;

  -- Создаем индекс для source (для фильтрации при поиске)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tours' AND indexname = 'idx_tours_source'
  ) THEN
    CREATE INDEX idx_tours_source ON tours(source);
    RAISE NOTICE '✅ Создан индекс idx_tours_source';
  ELSE
    RAISE NOTICE 'ℹ️ Индекс idx_tours_source уже существует';
  END IF;

  -- Создаем индекс для user_id (для быстрого поиска туров пользователя)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tours' AND indexname = 'idx_tours_user_id'
  ) THEN
    CREATE INDEX idx_tours_user_id ON tours(user_id);
    RAISE NOTICE '✅ Создан индекс idx_tours_user_id';
  ELSE
    RAISE NOTICE 'ℹ️ Индекс idx_tours_user_id уже существует';
  END IF;

  -- Устанавливаем source='guide' для существующих туров с guide_id
  UPDATE tours 
  SET source = 'guide' 
  WHERE source IS NULL AND guide_id IS NOT NULL;

  RAISE NOTICE '✅ Миграция завершена успешно';
END $$;

-- Комментарии к новым колонкам
COMMENT ON COLUMN tours.source IS 'Источник тура: guide (создан гидом), admin (создан админом), user_generated (сгенерирован AI для пользователя)';
COMMENT ON COLUMN tours.user_id IS 'ID пользователя, для которого создан тур (для user_generated туров)';





