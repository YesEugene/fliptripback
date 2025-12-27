-- ============================================================================
-- РАЗРЕШЕНИЕ NULL ДЛЯ guide_id В tour_bookings
-- ============================================================================
-- Для user_generated туров guide_id может быть null
-- Этот скрипт можно безопасно выполнять несколько раз (idempotent)
-- ============================================================================

DO $$
BEGIN
  -- Проверяем, есть ли constraint NOT NULL на guide_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tour_bookings' 
    AND column_name = 'guide_id' 
    AND is_nullable = 'NO'
  ) THEN
    -- Удаляем NOT NULL constraint
    ALTER TABLE tour_bookings 
    ALTER COLUMN guide_id DROP NOT NULL;
    
    RAISE NOTICE '✅ Removed NOT NULL constraint from guide_id in tour_bookings';
  ELSE
    RAISE NOTICE 'ℹ️ guide_id already allows NULL values';
  END IF;
END $$;

-- Комментарий
COMMENT ON COLUMN tour_bookings.guide_id IS 'Гид, который проводит тур. Может быть NULL для user_generated туров (AI-сгенерированных для пользователя)';




