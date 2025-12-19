-- ============================================
-- ПРОВЕРКА ТУРОВ В БАЗЕ ДАННЫХ SUPABASE
-- ============================================
-- Скопируйте этот запрос и вставьте в SQL Editor в Supabase
-- Затем нажмите кнопку "Run" (зеленая кнопка внизу справа)

-- 1. Показать ВСЕ туры (первые 50)
SELECT 
  id,
  title,
  is_published,
  city_id,
  guide_id,
  created_at,
  updated_at
FROM tours
ORDER BY created_at DESC
LIMIT 50;

-- 2. Статистика по турам
SELECT 
  COUNT(*) as всего_туров,
  COUNT(*) FILTER (WHERE is_published = true) as опубликовано,
  COUNT(*) FILTER (WHERE is_published = false) as не_опубликовано,
  COUNT(*) FILTER (WHERE is_published IS NULL) as без_статуса
FROM tours;

-- 3. Показать только опубликованные туры
SELECT 
  id,
  title,
  is_published,
  city_id,
  created_at
FROM tours
WHERE is_published = true
ORDER BY created_at DESC;

-- 4. Проверить структуру таблицы tours
SELECT 
  column_name as колонка,
  data_type as тип_данных,
  is_nullable as может_быть_null
FROM information_schema.columns
WHERE table_name = 'tours'
ORDER BY ordinal_position;


