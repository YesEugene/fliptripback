# Миграция: Добавление типа блока 'map' в tour_content_blocks

## Проблема
При попытке создать блок карты в Trip Visualizer возникает ошибка:
```
new row for relation "tour_content_blocks" violates check constraint "tour_content_blocks_block_type_check"
Code: 23514
```

Это происходит потому, что CHECK constraint на поле `block_type` не разрешает значение 'map'.

## Решение
Необходимо выполнить SQL миграцию в Supabase для обновления CHECK constraint, добавив 'map' в разрешенные значения.

## Инструкция

1. Откройте **Supabase Dashboard** → **SQL Editor**
2. Скопируйте и выполните содержимое файла `database/add-map-block-type.sql`
3. Проверьте, что constraint обновлен:
   ```sql
   SELECT constraint_name, check_clause 
   FROM information_schema.check_constraints 
   WHERE constraint_name = 'tour_content_blocks_block_type_check';
   ```

## Файл миграции
`database/add-map-block-type.sql`

## После выполнения миграции
- Блок карты можно будет создавать без ошибок
- Перезапустите backend deployment на Vercel (или подождите автоматического обновления)
- Попробуйте создать блок карты снова - ошибка должна исчезнуть

## Разрешенные типы блоков (после миграции)
- `location`
- `title`
- `photo_text`
- `text`
- `slide`
- `3columns`
- `photo`
- `divider`
- `map` ← **новый тип**

