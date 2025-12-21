-- ============================================================================
-- СИСТЕМА УПРАВЛЕНИЯ ДОСТУПНОСТЬЮ ДАТ ДЛЯ ГИДОВ
-- ============================================================================
-- Таблицы для управления доступностью дат и бронированиями туров с гидом
-- ============================================================================

-- 1. Добавляем поле default_group_size в таблицу tours
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tours' AND column_name = 'default_group_size'
  ) THEN
    ALTER TABLE tours
    ADD COLUMN default_group_size INTEGER DEFAULT 10;
    
    COMMENT ON COLUMN tours.default_group_size IS 'Размер группы по умолчанию для туров с гидом';
    
    RAISE NOTICE 'Column default_group_size added to tours table';
  ELSE
    RAISE NOTICE 'Column default_group_size already exists in tours table';
  END IF;
END $$;

-- 2. Таблица слотов доступности для туров
CREATE TABLE IF NOT EXISTS tour_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Управление размером группы
  max_group_size INTEGER DEFAULT 10, -- Максимальный размер группы на эту дату
  booked_spots INTEGER DEFAULT 0, -- Количество забронированных мест
  
  -- Статус доступности
  is_available BOOLEAN DEFAULT true, -- Доступна ли дата для бронирования
  is_blocked BOOLEAN DEFAULT false, -- Заблокирована ли дата гидом (недоступна)
  
  -- Дополнительные настройки для конкретной даты
  custom_price DECIMAL(10,2), -- Кастомная цена для этой даты (если отличается от стандартной)
  notes TEXT, -- Заметки гида для этой даты
  
  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Уникальность: одна запись на тур + дату
  UNIQUE(tour_id, date)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_availability_tour_id ON tour_availability_slots(tour_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON tour_availability_slots(date);
CREATE INDEX IF NOT EXISTS idx_availability_tour_date ON tour_availability_slots(tour_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_is_available ON tour_availability_slots(is_available);
CREATE INDEX IF NOT EXISTS idx_availability_is_blocked ON tour_availability_slots(is_blocked);
-- Удаляем индекс с CURRENT_DATE (не IMMUTABLE), используем обычный индекс
-- CREATE INDEX IF NOT EXISTS idx_availability_date_range ON tour_availability_slots(tour_id, date) WHERE date >= CURRENT_DATE;

-- Комментарии
COMMENT ON TABLE tour_availability_slots IS 'Управление доступностью конкретных дат для туров с гидом';
COMMENT ON COLUMN tour_availability_slots.max_group_size IS 'Максимальный размер группы на эту дату';
COMMENT ON COLUMN tour_availability_slots.booked_spots IS 'Количество забронированных мест (автоматически обновляется)';
COMMENT ON COLUMN tour_availability_slots.is_available IS 'Доступна ли дата для бронирования (вычисляется: booked_spots < max_group_size && !is_blocked)';
COMMENT ON COLUMN tour_availability_slots.is_blocked IS 'Заблокирована ли дата гидом (недоступна для бронирования)';

-- 3. Таблица бронирований туров
CREATE TABLE IF NOT EXISTS tour_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Клиент, который забронировал
  guide_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Гид, который проводит тур
  
  -- Дата и время тура
  tour_date DATE NOT NULL,
  meeting_point TEXT, -- Точка встречи (может отличаться от стандартной)
  meeting_time TIME, -- Время встречи (может отличаться от стандартного)
  
  -- Информация о группе
  group_size INTEGER NOT NULL DEFAULT 1, -- Количество человек в группе
  participants JSONB, -- Дополнительная информация об участниках (имена, контакты)
  
  -- Ценообразование
  base_price DECIMAL(10,2) NOT NULL, -- Базовая цена тура
  additional_services_price DECIMAL(10,2) DEFAULT 0, -- Цена дополнительных услуг
  total_price DECIMAL(10,2) NOT NULL, -- Общая цена
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Статус бронирования
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, cancelled, completed
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, refunded
  
  -- Дополнительные услуги
  additional_services JSONB, -- { photography: true, food: true, transportation: true }
  
  -- Коммуникация
  customer_notes TEXT, -- Заметки от клиента
  guide_notes TEXT, -- Заметки от гида
  
  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE, -- Когда бронирование подтверждено
  cancelled_at TIMESTAMP WITH TIME ZONE, -- Когда бронирование отменено
  
  -- Связь с платежом (если используется Stripe)
  payment_intent_id VARCHAR(255), -- Stripe Payment Intent ID
  checkout_session_id VARCHAR(255) -- Stripe Checkout Session ID
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON tour_bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON tour_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guide_id ON tour_bookings(guide_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_date ON tour_bookings(tour_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON tour_bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON tour_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_date_status ON tour_bookings(tour_id, tour_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_guide_status ON tour_bookings(guide_id, status);

-- Комментарии
COMMENT ON TABLE tour_bookings IS 'Бронирования туров с гидом';
COMMENT ON COLUMN tour_bookings.status IS 'Статус бронирования: pending, confirmed, cancelled, completed';
COMMENT ON COLUMN tour_bookings.payment_status IS 'Статус оплаты: pending, paid, refunded';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON tour_availability_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON tour_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для автоматического обновления booked_spots при изменении бронирований
CREATE OR REPLACE FUNCTION update_availability_booked_spots()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления booked_spots
CREATE TRIGGER trigger_update_booked_spots_insert
  AFTER INSERT ON tour_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_booked_spots();

CREATE TRIGGER trigger_update_booked_spots_update
  AFTER UPDATE ON tour_bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.group_size IS DISTINCT FROM NEW.group_size)
  EXECUTE FUNCTION update_availability_booked_spots();

CREATE TRIGGER trigger_update_booked_spots_delete
  AFTER DELETE ON tour_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_booked_spots();

-- Миграция существующих данных из meta.available_dates
DO $$
DECLARE
  tour_record RECORD;
  date_value TEXT;
BEGIN
  -- Для всех туров с withGuide = true и meta.available_dates
  FOR tour_record IN 
    SELECT id, default_group_size, meta
    FROM tours
    WHERE default_format = 'with_guide'
      AND meta IS NOT NULL
      AND meta->>'available_dates' IS NOT NULL
      AND jsonb_array_length(meta->'available_dates') > 0
  LOOP
    -- Создаем слоты для каждой даты из available_dates
    FOR date_value IN 
      SELECT jsonb_array_elements_text(tour_record.meta->'available_dates')
    LOOP
      BEGIN
        INSERT INTO tour_availability_slots (
          tour_id,
          date,
          max_group_size,
          is_available,
          is_blocked
        )
        VALUES (
          tour_record.id,
          date_value::date,
          COALESCE(tour_record.default_group_size, 10),
          true,
          false
        )
        ON CONFLICT (tour_id, date) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        -- Игнорируем ошибки (например, неверный формат даты)
        RAISE NOTICE 'Error creating slot for tour % date %: %', tour_record.id, date_value, SQLERRM;
      END;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: created availability slots from meta.available_dates';
END $$;

-- Установка default_group_size для существующих туров с гидом
UPDATE tours
SET default_group_size = 10
WHERE default_format = 'with_guide'
  AND default_group_size IS NULL;

-- Финальное сообщение
DO $$
BEGIN
  RAISE NOTICE 'Schema for guide availability system created successfully';
END $$;

