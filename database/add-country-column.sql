-- ============================================================================
-- ДОБАВЛЕНИЕ КОЛОНКИ COUNTRY В ТАБЛИЦУ TOURS
-- ============================================================================
-- Этот скрипт можно безопасно выполнять несколько раз (idempotent)
-- Выполните его в Supabase Dashboard → SQL Editor
-- ============================================================================

DO $$
BEGIN
  -- Добавляем колонку country, если её нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tours' AND column_name = 'country'
  ) THEN
    ALTER TABLE tours ADD COLUMN country VARCHAR(100);
    RAISE NOTICE '✅ Добавлена колонка country в таблицу tours';
  ELSE
    RAISE NOTICE 'ℹ️ Колонка country уже существует';
  END IF;
END $$;

-- Комментарий к колонке
COMMENT ON COLUMN tours.country IS 'Название страны (например: Portugal, France, Spain)';


