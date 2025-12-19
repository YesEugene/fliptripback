# Миграция к нормализованной структуре туров

## Шаг 1: Применить схему БД в Supabase

1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте содержимое файла `schema-tours.sql`
3. Выполните SQL скрипт

Это создаст:
- Таблицу `tours` с колонкой `guide_id` (FK → users)
- Таблицу `tour_days`
- Таблицу `tour_blocks`
- Таблицу `tour_items` с `location_id` (FK → locations)
- Таблицу `tour_tags`
- Индексы для производительности

## Шаг 2: Проверить существующие туры

Если у вас уже есть туры в таблице `tours` с полем `daily_plan` (JSON):

1. Проверьте, какая колонка используется для creator:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'tours' 
   AND column_name IN ('creator_id', 'user_id', 'created_by', 'guide_id');
   ```

2. Если колонка `guide_id` не существует, но есть `creator_id` или `user_id`:
   - Либо переименуйте колонку: `ALTER TABLE tours RENAME COLUMN creator_id TO guide_id;`
   - Либо добавьте новую: `ALTER TABLE tours ADD COLUMN guide_id UUID REFERENCES users(id);`

## Шаг 3: Миграция существующих туров (опционально)

Если нужно мигрировать существующие туры из JSON в нормализованную структуру, создайте скрипт миграции.

## Что изменилось

### До:
- Туры сохранялись как JSON в поле `daily_plan`
- Локации хранились как текст в JSON
- Нет связи tour_items → location_id

### После:
- ✅ Нормализованная структура: tours → tour_days → tour_blocks → tour_items
- ✅ Каждый tour_item ссылается на location_id (FK)
- ✅ Туры ищутся в БД перед генерацией нового маршрута
- ✅ Правильная колонка guide_id (FK → users)

## Проверка

После применения схемы:

1. Создайте новый тур через интерфейс креатора
2. Проверьте в Supabase, что:
   - Тур создан в таблице `tours` с `guide_id`
   - Созданы записи в `tour_days`, `tour_blocks`, `tour_items`
   - `tour_items.location_id` ссылается на `locations.id`

3. Проверьте поиск туров:
   - Создайте тур для города (например, Lisbon)
   - Попробуйте сгенерировать маршрут для того же города
   - Должен использоваться найденный тур, а не генерироваться новый


