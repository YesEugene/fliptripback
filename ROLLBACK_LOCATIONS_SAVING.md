# Инструкция по откату: Сохранение локаций при генерации

## Текущее состояние

**Коммит:** `2eba371` - "feat: Stop saving generated locations to database"

**Изменения:**
- Убран вызов `saveGooglePlaceToDatabase()` при сохранении сгенерированных туров
- Google Places локации сохраняются только в `tour_items.custom_*` поля
- В админ-панели по умолчанию скрыты AI-сгенерированные локации

## Как откатить изменения

### Вариант 1: Git откат (рекомендуется)

```bash
cd fliptrip-clean-backend
git revert 2eba371
git push
```

### Вариант 2: Ручное восстановление

1. **В `api/smart-itinerary.js` (строка ~238):**
   - Вернуть вызов `saveGooglePlaceToDatabase()`:
   ```javascript
   // If location is from Google Places, save it first
   else if (activity.fromGooglePlace && activity.location) {
     locationId = await saveGooglePlaceToDatabase({
       name: activity.name || activity.title,
       address: activity.location,
       category: activity.category || 'attraction',
       googlePlaceId: activity.googlePlaceId,
       photos: activity.photos || [],
       priceLevel: activity.priceLevel || 2
     }, cityId);
   }
   ```

2. **В `api/admin-locations.js` (строка ~53):**
   - Убрать фильтр по умолчанию:
   ```javascript
   // Удалить или закомментировать:
   // if (source === undefined && verified === undefined) {
   //   query = query.or('verified.eq.true,source.eq.admin,source.eq.guide');
   // }
   ```

## Важные замечания

- Функция `saveGooglePlaceToDatabase()` осталась в коде и готова к использованию
- Существующие туры не затронуты - они продолжают работать
- Новые туры будут сохранять локации в БД после отката

## Проверка после отката

1. Сгенерировать новый тур
2. Проверить, что локации появились в таблице `locations` с `source='google'` и `verified=false`
3. Проверить, что локации видны в админ-панели (если убрали фильтр)

