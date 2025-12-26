# Миграция для поддержки интересов в tour_tags

## Проблема
Таблица `tour_tags` изначально была создана только с полями `tour_id` и `tag_id`, но для поддержки интересов (interests) нужно добавить поле `interest_id`.

## Решение
Примените миграцию `add-interest-id-to-tour-tags.sql` в Supabase.

## Шаги

1. **Откройте Supabase Dashboard**
   - Перейдите на https://supabase.com/dashboard
   - Выберите ваш проект

2. **Откройте SQL Editor**
   - В левом меню нажмите "SQL Editor"
   - Нажмите "New query"

3. **Скопируйте и выполните SQL из файла `add-interest-id-to-tour-tags.sql`**
   ```sql
   -- Add interest_id column if it doesn't exist
   ALTER TABLE tour_tags 
   ADD COLUMN IF NOT EXISTS interest_id UUID REFERENCES interests(id) ON DELETE CASCADE;

   -- Create index for interest_id
   CREATE INDEX IF NOT EXISTS idx_tour_tags_interest_id ON tour_tags(interest_id);

   -- Add check constraint to ensure either tag_id or interest_id is set (but not both)
   ALTER TABLE tour_tags
   DROP CONSTRAINT IF EXISTS tour_tags_tag_or_interest_check;

   ALTER TABLE tour_tags
   ADD CONSTRAINT tour_tags_tag_or_interest_check 
   CHECK (
     (tag_id IS NOT NULL AND interest_id IS NULL) OR 
     (tag_id IS NULL AND interest_id IS NOT NULL)
   );

   -- Add unique indexes to ensure uniqueness for both tag_id and interest_id cases
   CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_tag 
   ON tour_tags(tour_id, tag_id) 
   WHERE tag_id IS NOT NULL;

   CREATE UNIQUE INDEX IF NOT EXISTS tour_tags_unique_interest 
   ON tour_tags(tour_id, interest_id) 
   WHERE interest_id IS NOT NULL;
   ```

4. **Проверьте результат**
   - Убедитесь, что миграция выполнилась без ошибок
   - Проверьте, что колонка `interest_id` появилась в таблице `tour_tags`

## После применения миграции

1. Теги (интересы) должны сохраняться при сохранении тура
2. Теги должны загружаться при загрузке тура
3. Теги должны отображаться в визуалайзере после перезагрузки страницы

## Проверка

После применения миграции:
1. Добавьте интересы к туру
2. Сохраните тур
3. Перезагрузите страницу
4. Интересы должны остаться на месте

## Если миграция уже применена

Если колонка `interest_id` уже существует, миграция не изменит ничего (используется `IF NOT EXISTS`), но добавит индексы и ограничения, если их нет.

