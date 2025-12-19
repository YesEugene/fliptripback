# Scripts

## Generate Sample Tours

Скрипт для генерации 10 примерных туров в базе данных.

### Запуск

```bash
cd /Users/yes/Downloads/FlipTrip/fliptrip-clean-backend
npm run generate-tours
```

Или напрямую:

```bash
node scripts/generate-sample-tours.js
```

### Требования

- Переменные окружения `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` должны быть установлены
- В базе данных должен существовать хотя бы один пользователь с ролью `creator` или `guide` (для привязки туров)

### Что делает скрипт

1. Создает 10 туров для разных городов:
   - Paris - Romantic Weekend
   - Barcelona - Artistic Exploration
   - Amsterdam - Cycling Adventure
   - Rome - Ancient History Tour
   - Lisbon - Coastal Charm
   - Berlin - Modern Art & Nightlife
   - London - Royal Experience
   - Madrid - Food & Culture
   - Prague - Medieval Magic
   - Vienna - Classical Music & Architecture

2. Для каждого тура:
   - Создает или находит город в таблице `cities`
   - Создает теги в таблице `tags`
   - Создает тур в таблице `tours`
   - Создает структуру `tour_days` → `tour_blocks` → `tour_items`
   - Создает локации в таблице `locations` (если их еще нет)
   - Связывает теги с туром через `tour_tags`

### Результат

После успешного выполнения скрипта в базе данных будет 10 опубликованных туров, которые будут отображаться на главной странице.



