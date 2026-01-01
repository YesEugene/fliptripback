# Импорт городов из CSV

## Подготовка

1. Убедитесь, что файл `worldcities.csv` находится в корне проекта `fliptrip-clean-backend/`
2. Проверьте, что в `.env.local` установлены переменные:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (рекомендуется) или `SUPABASE_ANON_KEY`

## Выполнение миграции

Сначала выполните SQL миграцию для добавления поля `country`:

```sql
-- Выполнить в Supabase SQL Editor
-- Файл: database/add-country-to-cities.sql
```

## Импорт городов

```bash
cd fliptrip-clean-backend
node scripts/import-world-cities.js worldcities.csv
```

Или с полным путем:

```bash
node scripts/import-world-cities.js /path/to/worldcities.csv
```

## Что делает скрипт

1. Парсит CSV файл (формат: `city;country;iso2;population;id`)
2. Проверяет существующие города в БД
3. Вставляет новые города с полями `name` и `country`
4. Обновляет существующие города, добавляя поле `country`
5. Импортирует батчами по 1000 записей для производительности

## Результат

После импорта в таблице `cities` будет ~48060 городов с полями:
- `id` (UUID)
- `name` (название города)
- `country` (название страны)

## Проверка

После импорта проверьте количество городов:

```sql
SELECT COUNT(*) FROM cities;
SELECT COUNT(*) FROM cities WHERE country IS NOT NULL;
```

## Важно

- Скрипт безопасен: можно запускать несколько раз
- Существующие города будут обновлены (добавлено поле `country`)
- Новые города будут добавлены
- Если поле `country` уже заполнено, скрипт пропустит импорт



