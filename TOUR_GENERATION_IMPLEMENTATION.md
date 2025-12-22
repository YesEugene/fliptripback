# Реализация сохранения AI-сгенерированных туров в БД

## Обзор

Реализована система сохранения AI-сгенерированных туров в базу данных при генерации превью, что позволяет:
- Пользователям возвращаться к своим турам по ссылке
- Записывать покупки в `tour_bookings` для аналитики
- Исключать AI-контент из публичного поиска

## Изменения в БД

### SQL Миграция: `database/add-tour-source-user-id.sql`

Добавлены поля в таблицу `tours`:
- `source` VARCHAR(50): 'guide', 'admin', 'user_generated'
- `user_id` UUID: связь с пользователем для user_generated туров

Индексы:
- `idx_tours_source` - для фильтрации при поиске
- `idx_tours_user_id` - для поиска туров пользователя

## Изменения в Backend

### 1. `api/smart-itinerary.js`

**Новые функции:**
- `getOrCreateUser(email)` - получение/создание пользователя по email
- `saveGooglePlaceToDatabase(placeData, cityId)` - сохранение локаций из Google Places с `source='google'`, `verified=false`
- `saveGeneratedTourToDatabase(tourData, userId, cityId, activities)` - сохранение тура в БД

**Логика:**
- При `previewOnly=true` создается тур в БД с:
  - `source='user_generated'`
  - `is_published=false`
  - `status='draft'`
  - `user_id` = ID пользователя (если email предоставлен)
  - `guide_id=null`
- Сохраняются все активности в структуру `tour_days/tour_blocks/tour_items`
- Локации из Google Places сохраняются в `locations` с `source='google'`, `verified=false`
- В ответе API возвращается `tourId`

### 2. `database/services/toursService.js`

**Изменения:**
- Добавлен фильтр `.or('source.is.null,source.neq.user_generated')` в `searchToursForItinerary`
- Исключает `user_generated` туры из поиска, но включает существующие туры (source=NULL)

### 3. `database/services/locationsService.js`

**Уже работает:**
- Фильтр `.eq('verified', true)` исключает AI-локации из поиска
- Локации с `source='google'` и `verified=false` не попадают в результаты

## Изменения во Frontend

### `pages/ItineraryPage.jsx`

**Изменения:**
- Передача `email` и `previewOnly` в запрос `generateSmartItinerary`
- Сохранение `tourId` из ответа API в state
- Обновление URL с `tourId` для возможности вернуться к туру
- Использование `tourId` при оплате (уже реализовано)

## Поток работы

1. **Генерация превью:**
   - Пользователь вводит фильтры на главной странице
   - Вызывается `smart-itinerary` API с `previewOnly=true` и `email`
   - API генерирует маршрут и создает тур в БД
   - Возвращается `tourId` в ответе
   - Фронтенд сохраняет `tourId` и обновляет URL

2. **Оплата:**
   - При оплате `tourId` передается в `create-checkout-session`
   - Webhook создает запись в `tour_bookings` с `tour_id`
   - Покупка видна в аналитике админа

3. **Возврат к туру:**
   - Пользователь открывает ссылку с `tourId`
   - Фронтенд загружает тур из БД через `loadTourFromDatabase`
   - Отображается полный или превью тур в зависимости от оплаты

## Важные моменты

1. **Безопасность:**
   - Пользователи видят только свои туры (через `user_id` или `tour_bookings`)
   - AI-туры не попадают в публичный поиск

2. **Обратная совместимость:**
   - Существующие туры: `source=NULL` (считаются турами гидов)
   - Поиск работает как раньше

3. **Производительность:**
   - Индексы на `source` и `user_id` для быстрого поиска
   - Фильтрация на уровне БД

## Следующие шаги

1. Выполнить SQL миграцию в Supabase
2. Протестировать полный цикл: генерация → сохранение → оплата
3. Добавить очистку старых `user_generated` туров (опционально, через 30 дней)

