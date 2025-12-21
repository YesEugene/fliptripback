# Добавление колонки country в таблицу tours

## Проблема

При создании тура возникает ошибка:
```
Could not find the 'country' column of 'tours' in the schema cache
```

## Решение

Выполните SQL миграцию в Supabase Dashboard → SQL Editor:

```sql
-- Скопируйте содержимое файла add-country-column.sql
```

Или выполните:

```sql
ALTER TABLE tours ADD COLUMN IF NOT EXISTS country VARCHAR(100);
```

## Проверка

После выполнения проверьте:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tours' AND column_name = 'country';
```

Если запрос возвращает строку с `country VARCHAR(100)` — всё готово!

## Альтернатива

Если не хотите добавлять колонку прямо сейчас, код будет работать без неё (country просто не будет сохраняться, но тур создастся).



