-- ============================================================================
-- СИСТЕМА УВЕДОМЛЕНИЙ И ЧАТА
-- ============================================================================
-- Таблицы для in-app уведомлений и сообщений между гидом и клиентом
-- ============================================================================

-- 1. Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Тип и содержание уведомления
  type VARCHAR(50) NOT NULL, -- 'booking', 'message', 'system', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Связь с другими сущностями
  related_id UUID, -- booking_id, message_id, etc.
  related_type VARCHAR(50), -- 'booking', 'message', etc.
  
  -- Статус
  is_read BOOLEAN DEFAULT false,
  
  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Дополнительные данные
  metadata JSONB -- Дополнительная информация в JSON формате
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_type, related_id);

-- Комментарии
COMMENT ON TABLE notifications IS 'In-app уведомления для пользователей';
COMMENT ON COLUMN notifications.type IS 'Тип уведомления: booking, message, system';
COMMENT ON COLUMN notifications.is_read IS 'Прочитано ли уведомление';

-- 2. Таблица сообщений (чат между гидом и клиентом)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Связь с бронированием (чат привязан к конкретному бронированию)
  booking_id UUID NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
  
  -- Отправитель и получатель
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Содержание сообщения
  message TEXT NOT NULL,
  
  -- Статус
  is_read BOOLEAN DEFAULT false,
  
  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Дополнительные данные
  attachments JSONB -- Ссылки на файлы, изображения и т.д.
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_booking_created ON messages(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;

-- Комментарии
COMMENT ON TABLE messages IS 'Сообщения между гидом и клиентом в рамках бронирования';
COMMENT ON COLUMN messages.booking_id IS 'Бронирование, к которому привязан чат';
COMMENT ON COLUMN messages.is_read IS 'Прочитано ли сообщение получателем';

-- Функция для автоматического обновления updated_at (если еще не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления read_at при прочтении уведомления
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
  EXECUTE FUNCTION update_notification_read_at;

-- Триггер для автоматического обновления read_at при прочтении сообщения
CREATE OR REPLACE FUNCTION update_message_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_read_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
  EXECUTE FUNCTION update_message_read_at;

-- Функция для создания уведомления о новом сообщении
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Триггер для автоматического создания уведомления при новом сообщении
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

