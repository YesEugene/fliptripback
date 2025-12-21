# Инструкция по применению миграции системы управления доступностью

## Шаг 1: Выполнение SQL миграции

### Вариант 1: Через Supabase Dashboard (Рекомендуется)

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект FlipTrip
3. Перейдите в раздел **SQL Editor** (левый сайдбар)
4. Нажмите **New Query**
5. Скопируйте содержимое файла `database/schema-guide-availability.sql`
6. Вставьте в редактор
7. Нажмите **Run** (или `Cmd/Ctrl + Enter`)

### Вариант 2: Через psql (если есть доступ к базе)

```bash
psql -h <your-db-host> -U postgres -d postgres -f database/schema-guide-availability.sql
```

## Шаг 2: Проверка успешного применения

После выполнения миграции проверьте, что созданы таблицы:

```sql
-- Проверить наличие таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('tour_availability_slots', 'tour_bookings');

-- Проверить наличие колонки default_group_size в tours
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tours' 
  AND column_name = 'default_group_size';

-- Проверить индексы
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('tour_availability_slots', 'tour_bookings');
```

Ожидаемый результат:
- ✅ `tour_availability_slots` - таблица существует
- ✅ `tour_bookings` - таблица существует
- ✅ `default_group_size` - колонка существует в `tours`
- ✅ Индексы созданы

## Шаг 3: Проверка миграции данных

Проверьте, что существующие туры с гидом получили слоты доступности:

```sql
-- Проверить количество туров с гидом
SELECT COUNT(*) as tours_with_guide
FROM tours
WHERE default_format = 'with_guide';

-- Проверить количество созданных слотов
SELECT COUNT(*) as availability_slots
FROM tour_availability_slots;

-- Проверить примеры слотов
SELECT 
  tas.tour_id,
  t.title,
  tas.date,
  tas.max_group_size,
  tas.is_available,
  tas.is_blocked
FROM tour_availability_slots tas
JOIN tours t ON tas.tour_id = t.id
LIMIT 10;
```

## Возможные ошибки и решения

### Ошибка: "column already exists"
- Это нормально, миграция использует `IF NOT EXISTS`
- Продолжайте выполнение

### Ошибка: "function update_updated_at_column does not exist"
- Выполните сначала `database/schema-tours.sql` (там создается эта функция)
- Или создайте функцию вручную:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';
```

### Ошибка: "relation tours does not exist"
- Убедитесь, что таблица `tours` существует
- Выполните сначала `database/schema-tours.sql`

## После успешной миграции

✅ Миграция выполнена успешно
✅ Можно переходить к тестированию API эндпоинтов

