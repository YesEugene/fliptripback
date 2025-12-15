# Добавление категорий Health и Unique Experiences

## Проблема
Категории Health и Unique Experiences не отображаются в фильтре, при создании тура или локации.

## Решение

### Шаг 1: Выполните миграцию в Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Создайте новый запрос
5. Скопируйте и выполните содержимое файла `006_ensure_health_unique_categories.sql`

Или выполните этот SQL напрямую:

```sql
-- Migration: Ensure Health and Unique categories exist with all interests
-- This script ensures categories are created even if they don't exist

-- Insert categories if they don't exist
INSERT INTO interest_categories (name, icon, display_order, description) VALUES
  ('health', '🧘', 8, 'Отдых, направленный на релаксацию, спа-процедуры, медитацию, йогу, термальные источники.'),
  ('unique', '🎪', 9, 'Интересы, которые не входят в число других категорий: фестивали, мероприятия, посещение тематических парков, волонтёрство, хобби.')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    display_order = EXCLUDED.display_order;

-- Add description column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interest_categories' AND column_name = 'description'
  ) THEN
    ALTER TABLE interest_categories ADD COLUMN description TEXT;
    -- Update existing categories with descriptions
    UPDATE interest_categories 
    SET description = 'Отдых, направленный на релаксацию, спа-процедуры, медитацию, йогу, термальные источники.'
    WHERE name = 'health';
    
    UPDATE interest_categories 
    SET description = 'Интересы, которые не входят в число других категорий: фестивали, мероприятия, посещение тематических парков, волонтёрство, хобби.'
    WHERE name = 'unique';
  END IF;
END $$;

-- Ensure Health → Relaxation subcategory and interests
DO $$
DECLARE
  health_id UUID;
  relaxation_id UUID;
BEGIN
  SELECT id INTO health_id FROM interest_categories WHERE name = 'health';
  
  IF health_id IS NULL THEN
    INSERT INTO interest_categories (name, icon, display_order, description) VALUES
      ('health', '🧘', 8, 'Отдых, направленный на релаксацию, спа-процедуры, медитацию, йогу, термальные источники.')
    RETURNING id INTO health_id;
  END IF;
  
  -- Insert subcategory if it doesn't exist
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (health_id, 'relaxation', 1)
  ON CONFLICT (category_id, name) DO NOTHING
  RETURNING id INTO relaxation_id;
  
  IF relaxation_id IS NULL THEN
    SELECT id INTO relaxation_id FROM interest_subcategories WHERE category_id = health_id AND name = 'relaxation' LIMIT 1;
  END IF;
  
  -- Ensure interests exist
  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    (health_id, relaxation_id, 'spa salons', 1),
    (health_id, relaxation_id, 'yoga', 2),
    (health_id, relaxation_id, 'hot springs', 3)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Health category ensured: %', health_id;
END $$;

-- Ensure Unique → Events subcategory and interests
DO $$
DECLARE
  unique_id UUID;
  events_id UUID;
BEGIN
  SELECT id INTO unique_id FROM interest_categories WHERE name = 'unique';
  
  IF unique_id IS NULL THEN
    INSERT INTO interest_categories (name, icon, display_order, description) VALUES
      ('unique', '🎪', 9, 'Интересы, которые не входят в число других категорий: фестивали, мероприятия, посещение тематических парков, волонтёрство, хобби.')
    RETURNING id INTO unique_id;
  END IF;
  
  -- Insert subcategory if it doesn't exist
  INSERT INTO interest_subcategories (category_id, name, display_order) VALUES
    (unique_id, 'events', 1)
  ON CONFLICT (category_id, name) DO NOTHING
  RETURNING id INTO events_id;
  
  IF events_id IS NULL THEN
    SELECT id INTO events_id FROM interest_subcategories WHERE category_id = unique_id AND name = 'events' LIMIT 1;
  END IF;
  
  -- Ensure interests exist
  INSERT INTO interests (category_id, subcategory_id, name, display_order) VALUES
    (unique_id, events_id, 'music festivals', 1),
    (unique_id, events_id, 'local festivals', 2),
    (unique_id, events_id, 'conferences', 3)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Unique category ensured: %', unique_id;
END $$;
```

### Шаг 2: Проверьте результат

После выполнения миграции проверьте:

1. **В Supabase SQL Editor** выполните:
```sql
SELECT name, icon, display_order, description 
FROM interest_categories 
WHERE name IN ('health', 'unique')
ORDER BY display_order;
```

Должны вернуться 2 строки с категориями Health и Unique.

2. **Проверьте подкатегории:**
```sql
SELECT sc.name as subcategory, c.name as category
FROM interest_subcategories sc
JOIN interest_categories c ON sc.category_id = c.id
WHERE c.name IN ('health', 'unique');
```

3. **Проверьте интересы:**
```sql
SELECT i.name as interest, sc.name as subcategory, c.name as category
FROM interests i
JOIN interest_categories c ON i.category_id = c.id
LEFT JOIN interest_subcategories sc ON i.subcategory_id = sc.id
WHERE c.name IN ('health', 'unique')
ORDER BY c.display_order, sc.display_order, i.display_order;
```

### Шаг 3: Обновите страницу

После выполнения миграции:
1. Обновите страницу в браузере (Ctrl+F5 / Cmd+Shift+R)
2. Проверьте фильтр на главной странице - должны появиться категории Health и Unique Experiences
3. Проверьте админ-панель - при создании локации должны быть видны новые категории

## Что должно появиться

### Категория Health (🧘)
- **Подкатегория:** Relaxation
- **Интересы:** 
  - SPA Salons
  - Yoga
  - Hot Springs

### Категория Unique Experiences (🎪)
- **Подкатегория:** Events
- **Интересы:**
  - Music Festivals
  - Local Festivals
  - Conferences

## Если категории все еще не видны

1. Проверьте консоль браузера (F12) на наличие ошибок
2. Проверьте Network tab - запрос к `/api/interests?full_structure=true` должен возвращать все категории
3. Убедитесь, что миграция выполнена успешно (проверьте логи в Supabase)

