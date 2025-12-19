# Применение схемы guides и полей locations

## Шаг 1: Создать таблицу guides

Выполните в Supabase Dashboard → SQL Editor:

```sql
-- Скопируйте содержимое файла schema-guides.sql
```

Или выполните файл `database/schema-guides.sql` полностью.

## Шаг 2: Добавить поля в locations

Выполните в Supabase Dashboard → SQL Editor:

```sql
-- Скопируйте содержимое файла schema-locations-fields.sql
```

Или выполните файл `database/schema-locations-fields.sql` полностью.

## Проверка

После выполнения проверьте:

1. **Таблица guides:**
   ```sql
   SELECT * FROM guides LIMIT 1;
   ```

2. **Поля locations:**
   ```sql
   SELECT 
     website, 
     phone, 
     booking_url, 
     price_level, 
     source, 
     updated_by, 
     google_place_id 
   FROM locations 
   LIMIT 1;
   ```

Если запросы выполняются без ошибок — всё готово!


