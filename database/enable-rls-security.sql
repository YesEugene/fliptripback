-- ============================================================================
-- ВКЛЮЧЕНИЕ ROW LEVEL SECURITY (RLS) НА ВСЕХ ПУБЛИЧНЫХ ТАБЛИЦАХ
-- ============================================================================
-- Этот скрипт решает проблемы безопасности, обнаруженные Supabase Security Advisor
-- Выполните его в Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- ШАГ 1: ВКЛЮЧЕНИЕ RLS НА ВСЕХ ПУБЛИЧНЫХ ТАБЛИЦАХ
-- ============================================================================

-- Включаем RLS на таблице users
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице guides
ALTER TABLE IF EXISTS public.guides ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице countries
ALTER TABLE IF EXISTS public.countries ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице cities
ALTER TABLE IF EXISTS public.cities ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице locations
ALTER TABLE IF EXISTS public.locations ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице location_photos
ALTER TABLE IF EXISTS public.location_photos ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице location_tags
ALTER TABLE IF EXISTS public.location_tags ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице tags
ALTER TABLE IF EXISTS public.tags ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице tours
ALTER TABLE IF EXISTS public.tours ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице tour_days
ALTER TABLE IF EXISTS public.tour_days ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице tour_blocks
ALTER TABLE IF EXISTS public.tour_blocks ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на таблице tour_items
ALTER TABLE IF EXISTS public.tour_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ШАГ 2: СОЗДАНИЕ ПОЛИТИК БЕЗОПАСНОСТИ
-- ============================================================================

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ users
-- ============================================================================

-- Политика: Пользователи могут читать свой собственный профиль
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Политика: Пользователи могут обновлять свой собственный профиль
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Политика: Публичные данные пользователей доступны всем (для отображения авторов туров)
DROP POLICY IF EXISTS "Public user data is readable" ON public.users;
CREATE POLICY "Public user data is readable"
  ON public.users
  FOR SELECT
  USING (true); -- Разрешаем чтение публичных данных (id, email, avatar и т.д.)

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ guides
-- ============================================================================

-- Проверяем структуру таблицы guides и создаем политики соответственно
DO $$
DECLARE
  has_user_id BOOLEAN;
  has_id_as_pk BOOLEAN;
BEGIN
  -- Проверяем, существует ли колонка user_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guides'
      AND column_name = 'user_id'
  ) INTO has_user_id;

  -- Проверяем, является ли id первичным ключом и совпадает ли с users.id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'guides'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'id'
  ) INTO has_id_as_pk;

  -- Политика: Все могут читать публичные данные гидов
  DROP POLICY IF EXISTS "Guides are publicly readable" ON public.guides;
  EXECUTE 'CREATE POLICY "Guides are publicly readable"
    ON public.guides
    FOR SELECT
    USING (true)';

  -- Создаем политики в зависимости от структуры таблицы
  IF has_user_id THEN
    -- Если есть user_id, используем его
    DROP POLICY IF EXISTS "Guides can update own profile" ON public.guides;
    EXECUTE 'CREATE POLICY "Guides can update own profile"
      ON public.guides
      FOR UPDATE
      USING (auth.uid() = user_id)';

    DROP POLICY IF EXISTS "Guides can create own profile" ON public.guides;
    EXECUTE 'CREATE POLICY "Guides can create own profile"
      ON public.guides
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)';
  ELSIF has_id_as_pk THEN
    -- Если id совпадает с users.id, используем id
    DROP POLICY IF EXISTS "Guides can update own profile" ON public.guides;
    EXECUTE 'CREATE POLICY "Guides can update own profile"
      ON public.guides
      FOR UPDATE
      USING (auth.uid() = id)';

    DROP POLICY IF EXISTS "Guides can create own profile" ON public.guides;
    EXECUTE 'CREATE POLICY "Guides can create own profile"
      ON public.guides
      FOR INSERT
      WITH CHECK (auth.uid() = id)';
  ELSE
    -- Если структура неизвестна, создаем политику только для чтения
    RAISE NOTICE 'Warning: guides table structure unknown, only read policy created';
  END IF;
END $$;

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ countries
-- ============================================================================

-- Политика: Все могут читать страны (публичные данные)
DROP POLICY IF EXISTS "Countries are publicly readable" ON public.countries;
CREATE POLICY "Countries are publicly readable"
  ON public.countries
  FOR SELECT
  USING (true);

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ cities
-- ============================================================================

-- Политика: Все могут читать города (публичные данные)
DROP POLICY IF EXISTS "Cities are publicly readable" ON public.cities;
CREATE POLICY "Cities are publicly readable"
  ON public.cities
  FOR SELECT
  USING (true);

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ locations
-- ============================================================================

-- Политика: Все могут читать локации (публичные данные)
DROP POLICY IF EXISTS "Locations are publicly readable" ON public.locations;
CREATE POLICY "Locations are publicly readable"
  ON public.locations
  FOR SELECT
  USING (true);

-- Проверяем структуру таблицы locations и создаем политики соответственно
DO $$
DECLARE
  has_created_by BOOLEAN;
BEGIN
  -- Проверяем, существует ли колонка created_by
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'locations'
      AND column_name = 'created_by'
  ) INTO has_created_by;

  IF has_created_by THEN
    -- Если есть created_by, используем его для ограничения доступа
    DROP POLICY IF EXISTS "Location creators can update" ON public.locations;
    EXECUTE 'CREATE POLICY "Location creators can update"
      ON public.locations
      FOR UPDATE
      USING (auth.uid() = created_by)';

    DROP POLICY IF EXISTS "Location creators can insert" ON public.locations;
    EXECUTE 'CREATE POLICY "Location creators can insert"
      ON public.locations
      FOR INSERT
      WITH CHECK (auth.uid() = created_by)';
  ELSE
    -- Если created_by нет, разрешаем всем авторизованным пользователям
    DROP POLICY IF EXISTS "Authenticated users can update locations" ON public.locations;
    EXECUTE 'CREATE POLICY "Authenticated users can update locations"
      ON public.locations
      FOR UPDATE
      USING (auth.uid() IS NOT NULL)';

    DROP POLICY IF EXISTS "Authenticated users can insert locations" ON public.locations;
    EXECUTE 'CREATE POLICY "Authenticated users can insert locations"
      ON public.locations
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL)';
    
    RAISE NOTICE 'Warning: locations table has no created_by column, using authenticated users policy';
  END IF;
END $$;

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ location_photos
-- ============================================================================

-- Политика: Все могут читать фотографии локаций
DROP POLICY IF EXISTS "Location photos are publicly readable" ON public.location_photos;
CREATE POLICY "Location photos are publicly readable"
  ON public.location_photos
  FOR SELECT
  USING (true);

-- Политика для добавления фотографий (с проверкой структуры)
DO $$
DECLARE
  has_created_by BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'locations'
      AND column_name = 'created_by'
  ) INTO has_created_by;

  IF has_created_by THEN
    DROP POLICY IF EXISTS "Location creators can add photos" ON public.location_photos;
    EXECUTE 'CREATE POLICY "Location creators can add photos"
      ON public.location_photos
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.locations
          WHERE locations.id = location_photos.location_id
          AND locations.created_by = auth.uid()
        )
      )';
  ELSE
    DROP POLICY IF EXISTS "Authenticated users can add photos" ON public.location_photos;
    EXECUTE 'CREATE POLICY "Authenticated users can add photos"
      ON public.location_photos
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ location_tags
-- ============================================================================

-- Политика: Все могут читать теги локаций
DROP POLICY IF EXISTS "Location tags are publicly readable" ON public.location_tags;
CREATE POLICY "Location tags are publicly readable"
  ON public.location_tags
  FOR SELECT
  USING (true);

-- Политика для добавления тегов (с проверкой структуры)
DO $$
DECLARE
  has_created_by BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'locations'
      AND column_name = 'created_by'
  ) INTO has_created_by;

  IF has_created_by THEN
    DROP POLICY IF EXISTS "Location creators can add tags" ON public.location_tags;
    EXECUTE 'CREATE POLICY "Location creators can add tags"
      ON public.location_tags
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.locations
          WHERE locations.id = location_tags.location_id
          AND locations.created_by = auth.uid()
        )
      )';
  ELSE
    DROP POLICY IF EXISTS "Authenticated users can add tags" ON public.location_tags;
    EXECUTE 'CREATE POLICY "Authenticated users can add tags"
      ON public.location_tags
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ tags
-- ============================================================================

-- Политика: Все могут читать теги (публичные данные)
DROP POLICY IF EXISTS "Tags are publicly readable" ON public.tags;
CREATE POLICY "Tags are publicly readable"
  ON public.tags
  FOR SELECT
  USING (true);

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ tours
-- ============================================================================

-- Политика: Все могут читать опубликованные туры
DROP POLICY IF EXISTS "Published tours are publicly readable" ON public.tours;
CREATE POLICY "Published tours are publicly readable"
  ON public.tours
  FOR SELECT
  USING (status = 'approved' OR is_published = true);

-- Политика: Создатели могут читать свои туры (включая черновики)
DROP POLICY IF EXISTS "Tour creators can read own tours" ON public.tours;
CREATE POLICY "Tour creators can read own tours"
  ON public.tours
  FOR SELECT
  USING (auth.uid() = guide_id);

-- Политика: Создатели могут создавать туры
DROP POLICY IF EXISTS "Tour creators can create tours" ON public.tours;
CREATE POLICY "Tour creators can create tours"
  ON public.tours
  FOR INSERT
  WITH CHECK (auth.uid() = guide_id);

-- Политика: Создатели могут обновлять свои туры
DROP POLICY IF EXISTS "Tour creators can update own tours" ON public.tours;
CREATE POLICY "Tour creators can update own tours"
  ON public.tours
  FOR UPDATE
  USING (auth.uid() = guide_id);

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ tour_days
-- ============================================================================

-- Политика: Все могут читать дни опубликованных туров
DROP POLICY IF EXISTS "Tour days are readable for published tours" ON public.tour_days;
CREATE POLICY "Tour days are readable for published tours"
  ON public.tour_days
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tours
      WHERE tours.id = tour_days.tour_id
      AND (tours.status = 'approved' OR tours.is_published = true)
    )
  );

-- Политика: Создатели могут управлять днями своих туров
DROP POLICY IF EXISTS "Tour creators can manage own tour days" ON public.tour_days;
CREATE POLICY "Tour creators can manage own tour days"
  ON public.tour_days
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tours
      WHERE tours.id = tour_days.tour_id
      AND tours.guide_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tours
      WHERE tours.id = tour_days.tour_id
      AND tours.guide_id = auth.uid()
    )
  );

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ tour_blocks
-- ============================================================================

-- Политика: Все могут читать блоки опубликованных туров
DROP POLICY IF EXISTS "Tour blocks are readable for published tours" ON public.tour_blocks;
CREATE POLICY "Tour blocks are readable for published tours"
  ON public.tour_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_days
      JOIN public.tours ON tours.id = tour_days.tour_id
      WHERE tour_days.id = tour_blocks.tour_day_id
      AND (tours.status = 'approved' OR tours.is_published = true)
    )
  );

-- Политика: Создатели могут управлять блоками своих туров
DROP POLICY IF EXISTS "Tour creators can manage own tour blocks" ON public.tour_blocks;
CREATE POLICY "Tour creators can manage own tour blocks"
  ON public.tour_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_days
      JOIN public.tours ON tours.id = tour_days.tour_id
      WHERE tour_days.id = tour_blocks.tour_day_id
      AND tours.guide_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tour_days
      JOIN public.tours ON tours.id = tour_days.tour_id
      WHERE tour_days.id = tour_blocks.tour_day_id
      AND tours.guide_id = auth.uid()
    )
  );

-- ============================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ tour_items
-- ============================================================================

-- Политика: Все могут читать элементы опубликованных туров
DROP POLICY IF EXISTS "Tour items are readable for published tours" ON public.tour_items;
CREATE POLICY "Tour items are readable for published tours"
  ON public.tour_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_blocks
      JOIN public.tour_days ON tour_days.id = tour_blocks.tour_day_id
      JOIN public.tours ON tours.id = tour_days.tour_id
      WHERE tour_blocks.id = tour_items.tour_block_id
      AND (tours.status = 'approved' OR tours.is_published = true)
    )
  );

-- Политика: Создатели могут управлять элементами своих туров
DROP POLICY IF EXISTS "Tour creators can manage own tour items" ON public.tour_items;
CREATE POLICY "Tour creators can manage own tour items"
  ON public.tour_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_blocks
      JOIN public.tour_days ON tour_days.id = tour_blocks.tour_day_id
      JOIN public.tours ON tours.id = tour_days.tour_id
      WHERE tour_blocks.id = tour_items.tour_block_id
      AND tours.guide_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tour_blocks
      JOIN public.tour_days ON tour_days.id = tour_blocks.tour_day_id
      JOIN public.tours ON tours.id = tour_days.tour_id
      WHERE tour_blocks.id = tour_items.tour_block_id
      AND tours.guide_id = auth.uid()
    )
  );

-- ============================================================================
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- ============================================================================

DO $$
DECLARE
  rls_enabled_count INTEGER;
  policies_count INTEGER;
BEGIN
  -- Проверяем количество таблиц с включенным RLS
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true
    AND t.tablename IN ('users', 'guides', 'countries', 'cities', 'locations', 
                        'location_photos', 'location_tags', 'tags', 'tours', 
                        'tour_days', 'tour_blocks', 'tour_items');

  -- Проверяем количество созданных политик
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'guides', 'countries', 'cities', 'locations', 
                      'location_photos', 'location_tags', 'tags', 'tours', 
                      'tour_days', 'tour_blocks', 'tour_items');

  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ RLS ВКЛЮЧЕН НА % ТАБЛИЦАХ', rls_enabled_count;
  RAISE NOTICE '✅ СОЗДАНО % ПОЛИТИК БЕЗОПАСНОСТИ', policies_count;
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Теперь все публичные таблицы защищены Row Level Security';
  RAISE NOTICE 'Проверьте Security Advisor в Supabase Dashboard';
  RAISE NOTICE '============================================================================';
END $$;

