# Анализ локаций в базе данных

## Структура данных

### Таблица `locations`
- `id` - UUID
- `name` - название локации
- `category` - категория локации (текстовое поле)
- `city_id` - ID города
- `address`, `description`, `recommendations` - описание
- Другие поля...

### Таблица `location_interests`
Связующая таблица между локациями и интересами:
- `location_id` - FK к `locations.id`
- `interest_id` - FK к `interests.id`

### Таблица `interests`
- `id` - UUID
- `name` - название интереса (например, "cycling", "hiking")
- `category_id` - FK к категории интересов

## Как интересы присваиваются локациям

### При создании тура (`tours-create.js`, строки 260-280)
```javascript
// При создании локации из тура:
if (item.interests && Array.isArray(item.interests) && item.interests.length > 0) {
  const interestInserts = item.interests.map(interestId => ({
    location_id: locationId,
    interest_id: interestId
  }));
  await supabase.from('location_interests').insert(interestInserts);
}
```

**Вывод:** Интересы присваиваются локациям только если они указаны при создании тура через `item.interests`.

### При создании локации через админ-панель (`admin-locations.js`, строки 250-280)
```javascript
// При создании/обновлении локации:
if (interests && Array.isArray(interests) && interests.length > 0) {
  const interestInserts = interests.map(interestId => ({
    location_id: locationId,
    interest_id: interestId
  }));
  await supabase.from('location_interests').insert(interestInserts);
}
```

**Вывод:** Интересы присваиваются только если они явно указаны при создании/обновлении локации.

## Проблема

Судя по коду:
1. **Интересы не присваиваются автоматически** - они должны быть явно указаны при создании локации или тура
2. **Категория** (`location.category`) - это отдельное текстовое поле, не связанное с категориями интересов
3. **Связь с интересами** происходит через таблицу `location_interests`, которая может быть пустой для многих локаций

## Вопросы для проверки

1. Сколько локаций имеют записи в `location_interests`?
2. Сколько локаций имеют заполненное поле `category`?
3. Соответствует ли `location.category` категориям интересов (Active, Food, Culture и т.д.)?
4. При создании туров через `generate-sample-tours.js` присваиваются ли интересы локациям?

## Рекомендации

1. **Проверить данные** через endpoint `/api/analyze-locations` после деплоя
2. **Если большинство локаций без интересов:**
   - Нужно будет добавить интересы к существующим локациям
   - Или изменить логику фильтрации, чтобы использовать `location.category` как fallback
3. **Если `location.category` не соответствует категориям интересов:**
   - Нужно будет либо синхронизировать их
   - Либо использовать только `location_interests` для фильтрации


