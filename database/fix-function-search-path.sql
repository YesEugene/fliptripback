-- ============================================================================
-- ИСПРАВЛЕНИЕ ФУНКЦИЙ: УСТАНОВКА FIXED SEARCH_PATH
-- ============================================================================
-- Этот скрипт исправляет предупреждения Security Advisor о "Function Search Path Mutable"
-- Устанавливает фиксированный search_path для всех функций
-- Выполните его в Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. ФУНКЦИЯ update_updated_at_column()
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. ФУНКЦИЯ update_notification_read_at()
-- ============================================================================

CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. ФУНКЦИЯ update_message_read_at()
-- ============================================================================

CREATE OR REPLACE FUNCTION update_message_read_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. ФУНКЦИЯ notify_new_message()
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Создаем уведомление для получателя
  INSERT INTO notifications (user_id, type, title, message, related_id, related_type, is_read)
  VALUES (
    NEW.receiver_id,
    'message',
    'New Message',
    LEFT(NEW.message, 100), -- Первые 100 символов сообщения
    NEW.id,
    'message',
    false
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. ФУНКЦИЯ update_availability_booked_spots()
-- ============================================================================

CREATE OR REPLACE FUNCTION update_availability_booked_spots()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- При создании или обновлении бронирования
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.status != NEW.status OR OLD.group_size != NEW.group_size)) THEN
    -- Обновляем booked_spots для даты тура
    UPDATE tour_availability_slots
    SET booked_spots = (
      SELECT COALESCE(SUM(group_size), 0)
      FROM tour_bookings
      WHERE tour_id = NEW.tour_id
        AND tour_date = NEW.tour_date
        AND status NOT IN ('cancelled')
    ),
    is_available = (
      CASE 
        WHEN is_blocked = true THEN false
        WHEN booked_spots < max_group_size THEN true
        ELSE false
      END
    )
    WHERE tour_id = NEW.tour_id
      AND date = NEW.tour_date;
  END IF;
  
  -- При удалении бронирования
  IF TG_OP = 'DELETE' THEN
    UPDATE tour_availability_slots
    SET booked_spots = (
      SELECT COALESCE(SUM(group_size), 0)
      FROM tour_bookings
      WHERE tour_id = OLD.tour_id
        AND tour_date = OLD.tour_date
        AND status NOT IN ('cancelled')
    ),
    is_available = (
      CASE 
        WHEN is_blocked = true THEN false
        WHEN booked_spots < max_group_size THEN true
        ELSE false
      END
    )
    WHERE tour_id = OLD.tour_id
      AND date = OLD.tour_date;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- ============================================================================

DO $$
DECLARE
  functions_fixed INTEGER;
BEGIN
  -- Проверяем, что все функции имеют установленный search_path
  SELECT COUNT(*) INTO functions_fixed
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'update_updated_at_column',
      'update_notification_read_at',
      'update_message_read_at',
      'notify_new_message',
      'update_availability_booked_spots'
    )
    AND p.proconfig IS NOT NULL
    AND array_to_string(p.proconfig, ',') LIKE '%search_path%';

  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ ИСПРАВЛЕНО ФУНКЦИЙ: %', functions_fixed;
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Все функции теперь имеют фиксированный search_path = public';
  RAISE NOTICE 'Проверьте Security Advisor - предупреждения должны исчезнуть';
  RAISE NOTICE '============================================================================';
END $$;

