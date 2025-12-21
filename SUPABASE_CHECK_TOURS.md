# Как проверить туры в Supabase

## Способ 1: Table Editor (самый простой)

1. В левом меню Supabase нажмите на иконку **"Table Editor"** (вторая иконка сверху, выглядит как таблица)
2. В списке таблиц найдите и откройте таблицу **`tours`**
3. Вы увидите все туры в таблице
4. Проверьте колонку **`is_published`** - должно быть `true` для отображения на главной странице

## Способ 2: SQL Editor (через SQL запрос)

1. В левом меню Supabase нажмите на иконку **"SQL Editor"** (третья иконка сверху)
2. Нажмите кнопку **"New query"** или выберите существующий запрос
3. Вставьте следующий SQL запрос:

```sql
-- Проверить все туры
SELECT id, title, is_published, city_id, created_at 
FROM tours 
ORDER BY created_at DESC 
LIMIT 100;
```

4. Нажмите кнопку **"Run"** (зеленая кнопка внизу справа)
5. Вы увидите список всех туров

## Способ 3: Проверить количество туров

Вставьте этот запрос в SQL Editor:

```sql
-- Статистика по турам
SELECT 
  COUNT(*) as total_tours,
  COUNT(*) FILTER (WHERE is_published = true) as published_tours,
  COUNT(*) FILTER (WHERE is_published = false) as unpublished_tours,
  COUNT(*) FILTER (WHERE is_published IS NULL) as null_published
FROM tours;
```

## Способ 4: Проверить структуру таблицы

```sql
-- Показать структуру таблицы tours
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tours'
ORDER BY ordinal_position;
```

## Если туров нет в таблице `tours`

Возможно, туры находятся в другой таблице или базе данных. Проверьте:

1. Все таблицы в Table Editor - возможно туры в таблице с другим названием
2. Другие проекты Supabase - возможно туры в другом проекте
3. Локальная база данных - возможно туры создавались локально и не были загружены в Supabase



