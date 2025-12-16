# Применение таблицы location_tags

## Проблема
Код пытался сохранить теги в колонку `tags` таблицы `locations`, которой не существует.

## Решение
Теги для локаций хранятся в отдельной таблице `location_tags` (нормализованная структура).

## Шаги

1. **Откройте Supabase Dashboard → SQL Editor**

2. **Выполните SQL скрипт:**
   ```sql
   -- Таблица для связи локаций с тегами
   CREATE TABLE IF NOT EXISTS location_tags (
     location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
     tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
     PRIMARY KEY (location_id, tag_id)
   );

   -- Индексы для производительности
   CREATE INDEX IF NOT EXISTS idx_location_tags_location_id ON location_tags(location_id);
   CREATE INDEX IF NOT EXISTS idx_location_tags_tag_id ON location_tags(tag_id);
   ```

3. **Проверьте:**
   - Таблица `location_tags` создана
   - Индексы созданы

## Что изменилось в коде

- ✅ `admin-locations.js` - теги сохраняются в `location_tags`, а не в колонку `tags`
- ✅ `tours-create.js` - теги сохраняются в `location_tags`, а не в колонку `tags`
- ✅ `CreateTourPage.jsx` - убран `required` атрибут с скрытого file input

## После применения

1. Создайте локацию через админ-панель - должно работать
2. Создайте тур через ЛК креатора - должно работать
3. Теги будут сохраняться в таблицу `location_tags`

