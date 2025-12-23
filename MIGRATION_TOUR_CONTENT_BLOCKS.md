# Миграция: Создание таблицы tour_content_blocks

## Проблема
При попытке создать блок в Trip Visualizer возникает ошибка:
```
Could not find the table 'public.tour_content_blocks' in the schema cache
Code: PGRST205
```

## Решение
Необходимо выполнить SQL миграцию в Supabase для создания таблицы `tour_content_blocks`.

## Инструкция

1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте и выполните содержимое файла `database/add-tour-content-blocks.sql`
3. Проверьте, что таблица создана:
   ```sql
   SELECT * FROM tour_content_blocks LIMIT 1;
   ```

## Файл миграции
`database/add-tour-content-blocks.sql`

## После выполнения миграции
- Перезапустите backend deployment на Vercel (или подождите автоматического обновления)
- Попробуйте создать блок снова - ошибка должна исчезнуть

