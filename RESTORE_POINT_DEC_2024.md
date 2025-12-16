# FlipTrip - Точка восстановления (Декабрь 2024)

## 📋 Общая информация

**Дата создания:** 16 декабря 2024  
**Статус:** ✅ Полностью рабочая версия  
**Версия:** v2.0 - Production Ready

## 🎯 Текущее состояние системы

### ✅ Что работает:
- ✅ Генерация маршрутов с превью (2 локации) и полным планом
- ✅ Сохранение маршрутов в Redis
- ✅ Оплата через Stripe
- ✅ Отправка email через Resend после оплаты
- ✅ Загрузка полного плана после оплаты без регенерации
- ✅ Работа с базой данных PostgreSQL (Supabase)
- ✅ Админ-панель (управление локациями, турами, пользователями)
- ✅ Личный кабинет гида/креатора (создание и редактирование туров)
- ✅ Поиск локаций в БД перед Google Places
- ✅ Оптимизация OpenAI (gpt-3.5-turbo, минимум токенов)
- ✅ Правильные URL (flip-trip.com вместо vercel.app)
- ✅ CORS настроен для всех endpoints

## 📦 Зависимости

### Backend (`fliptrip-clean-backend/package.json`)

```json
{
  "dependencies": {
    "openai": "^4.20.1",
    "@googlemaps/google-maps-services-js": "^3.3.42",
    "@upstash/redis": "^1.35.6",
    "@supabase/supabase-js": "^2.39.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "stripe": "^14.21.0",
    "uuid": "^9.0.1",
    "resend": "^3.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Frontend (`fliptrip-clean-frontend/package.json`)

Проверьте актуальные зависимости в репозитории. Основные:
- React
- React Router DOM
- Axios
- html2pdf.js

## 🔐 Переменные окружения

### Backend (Vercel Environment Variables)

**Обязательные:**
```
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_KEY=...
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
FROM_EMAIL=enjoy@flip-trip.com
```

**Redis (Upstash):**
```
FTSTORAGE_KV_REST_API_URL=https://...
FTSTORAGE_KV_REST_API_TOKEN=...
```
или
```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Supabase:**
```
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**CORS:**
```
CORS_ORIGIN=https://flip-trip.com,https://www.flip-trip.com
```

### Frontend

```
VITE_API_URL=https://fliptripback.vercel.app
```

## 🗄️ Структура базы данных (PostgreSQL/Supabase)

### Основные таблицы:

1. **users** - Пользователи системы
   - id (UUID), email, password_hash, role (user/guide/admin), created_at

2. **guides** - Профили гидов/креаторов
   - id (UUID), user_id (FK), name, bio, avatar_url, instagram, facebook, twitter, linkedin, website

3. **cities** - Города
   - id (UUID), name, country, created_at

4. **locations** - Локации
   - id (UUID), city_id (FK), name, address, lat, lng, description, recommendations, category, price_level, website, phone, booking_url, source, google_place_id, verified, created_by, updated_by

5. **tags** - Теги
   - id (UUID), name, type

6. **location_tags** - Связь локаций и тегов
   - location_id (FK), tag_id (FK)

7. **tours** - Туры
   - id (UUID), guide_id (FK), title, description, city_id (FK), country, duration_type, duration_value, default_format, price_pdf, price_guided, currency, preview_media_url, preview_media_type, created_at, updated_at

8. **tour_days** - Дни тура
   - id (UUID), tour_id (FK), day_number, title, date_hint

9. **tour_blocks** - Блоки дня
   - id (UUID), tour_day_id (FK), start_time, end_time, title

10. **tour_items** - Элементы блока
    - id (UUID), tour_block_id (FK), location_id (FK), custom_title, custom_description, custom_recommendations, order_index, duration_minutes, approx_cost, notes

11. **tour_tags** - Связь туров и тегов
    - tour_id (FK), tag_id (FK)

12. **interests** - Интересы
    - id (UUID), name, category_id (FK)

13. **interest_categories** - Категории интересов
    - id (UUID), name

14. **interest_subcategories** - Подкатегории интересов
    - id (UUID), name, category_id (FK)

### SQL схемы находятся в:
- `fliptrip-clean-backend/database/schema-tours.sql`
- `fliptrip-clean-backend/database/schema-guides.sql`
- `fliptrip-clean-backend/database/schema-locations-fields.sql`
- `fliptrip-clean-backend/database/schema-location-tags.sql`
- `fliptrip-clean-backend/database/apply-schema.sql`

## 🛣️ API Endpoints (Backend)

### Основные endpoints:

1. **`/api/smart-itinerary`** (POST)
   - Генерация маршрута
   - Параметры: city, audience, interests, interest_ids, date, budget, previewOnly
   - Возвращает: полный маршрут с локациями

2. **`/api/save-itinerary`** (POST)
   - Сохранение маршрута в Redis
   - Параметры: itinerary (объект маршрута)
   - Возвращает: itineraryId

3. **`/api/get-itinerary`** (GET)
   - Получение маршрута из Redis
   - Параметры: id (itineraryId)
   - Возвращает: itinerary

4. **`/api/unlock-itinerary`** (POST)
   - Разблокировка маршрута после оплаты
   - Параметры: itineraryId
   - Обновляет previewOnly: false в Redis

5. **`/api/send-email`** (POST)
   - Отправка email через Resend
   - Параметры: email, itinerary, formData, itineraryId
   - Отправляет HTML письмо с ссылкой на маршрут

6. **`/api/create-checkout-session`** (POST)
   - Создание Stripe checkout session
   - Параметры: city, audience, interests, date, budget, email, itineraryId
   - Возвращает: session.url
   - Success URL: `https://flip-trip.com/success?...`

### Админ endpoints:

7. **`/api/admin-stats`** (GET)
   - Статистика для админ-панели

8. **`/api/admin-locations`** (GET, POST, PUT, DELETE)
   - Управление локациями

9. **`/api/admin-tours`** (GET, DELETE)
   - Управление турами

10. **`/api/admin-users`** (GET, POST, PUT, DELETE)
    - Управление пользователями

11. **`/api/admin-cities`** (GET)
    - Список городов

12. **`/api/admin-tags`** (GET)
    - Список тегов

### Аутентификация:

13. **`/api/auth-register`** (POST)
    - Регистрация пользователя

14. **`/api/auth-login`** (POST)
    - Вход в систему

15. **`/api/auth-me`** (GET)
    - Получение текущего пользователя

### Гид/Креатор:

16. **`/api/guide-profile`** (GET, PUT)
    - Профиль гида

17. **`/api/guide-tours`** (GET)
    - Список туров гида

18. **`/api/tours-create`** (POST)
    - Создание тура

19. **`/api/tours-update`** (PUT, PATCH, DELETE)
    - Обновление/удаление тура

20. **`/api/tours`** (GET)
    - Получение тура по ID

### Другие:

21. **`/api/interests`** (GET)
    - Список интересов

## 🔄 Последовательность работы системы

### 1. Генерация превью маршрута:
```
HomePage (фильтры) 
  → ItineraryPage (previewOnly=true)
  → POST /api/smart-itinerary (previewOnly: true)
  → Генерация полного плана (но показываем только 2 блока)
  → POST /api/save-itinerary (сохранение в Redis с previewOnly: true)
  → Отображение превью с формой email и кнопкой оплаты
```

### 2. Оплата:
```
Клик "Pay to Unlock"
  → POST /api/create-checkout-session
  → Редирект на Stripe
  → После оплаты: редирект на https://flip-trip.com/success?itineraryId=...
```

### 3. Success page:
```
SuccessPage
  → POST /api/unlock-itinerary (обновление previewOnly: false)
  → POST /api/send-email (отправка письма через Resend)
  → Кнопка "Open my plan" → редирект на /itinerary?itineraryId=...&full=true
```

### 4. Полный план:
```
ItineraryPage (full=true, itineraryId=...)
  → GET /api/get-itinerary (загрузка из Redis)
  → Отображение полного плана (без регенерации!)
```

## 🏗️ Архитектура

### Backend структура:
```
fliptrip-clean-backend/
├── api/                    # Serverless functions (Vercel)
│   ├── smart-itinerary.js  # Генерация маршрутов
│   ├── save-itinerary.js   # Сохранение в Redis
│   ├── get-itinerary.js    # Получение из Redis
│   ├── unlock-itinerary.js # Разблокировка после оплаты
│   ├── send-email.js       # Отправка email (Resend)
│   ├── create-checkout-session.js # Stripe checkout
│   ├── admin-*.js          # Админ endpoints
│   ├── auth-*.js            # Аутентификация
│   └── guide-*.js          # Гид endpoints
├── services/               # Бизнес-логика
│   ├── ItineraryPipeline.js
│   ├── LocationService.js
│   └── ContentGenerationService.js
├── database/
│   ├── db.js               # Supabase client
│   ├── services/           # DB сервисы
│   └── schema-*.sql        # SQL схемы
└── package.json
```

### Frontend структура:
```
fliptrip-clean-frontend/
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── ItineraryPage.jsx
│   │   ├── SuccessPage.jsx
│   │   └── PaymentPage.jsx
│   ├── modules/
│   │   ├── admin-dashboard/
│   │   ├── guide-dashboard/
│   │   └── user-dashboard/
│   ├── services/
│   │   └── api.js          # API клиент
│   └── components/
└── package.json
```

## 🔑 Ключевые особенности реализации

### 1. Генерация маршрута:
- **Приоритет 1:** Поиск туров в БД по городу, тегам, интересам
- **Приоритет 2:** Поиск локаций в БД
- **Приоритет 3:** Google Places API (fallback)
- **Приоритет 4:** Fallback локации

### 2. OpenAI оптимизация:
- Модель: `gpt-3.5-turbo` (не gpt-4)
- Максимум токенов: 200-800 (в зависимости от задачи)
- Короткие промпты без примеров

### 3. Redis структура:
```
itinerary:{itineraryId} → {
  title, subtitle, city, date, budget,
  daily_plan: [...], // полный план
  activities: [...], // альтернативный формат
  previewOnly: true/false,
  ...
}
```

### 4. CORS настройки:
Все endpoints имеют CORS заголовки:
- `Access-Control-Allow-Origin`: flip-trip.com, fliptripfrontend.vercel.app
- `Access-Control-Allow-Methods`: GET, POST, PUT, DELETE, OPTIONS
- `Access-Control-Allow-Headers`: Content-Type, Authorization, etc.

## 📝 Важные коммиты

### Backend (fliptripback):
- `3dfd5e3` - FEAT: Implement email sending via Resend and improve error handling
- `73cc3a8` - FIX: Success URL and send-email endpoint
- `904b550` - FIX: Improve get-itinerary endpoint error handling and CORS
- `850e727` - FEAT: Add unlock-itinerary endpoint
- `cff76a0` - FIX: Prevent automatic OpenAI/Google Places API calls
- `4be7ea7` - FIX: Use correct column names for social links in guides table
- `007151e` - FIX: Rewrite guide-profile to use PostgreSQL instead of Redis
- `ef73b21` - FIX: Use select('*') for DELETE operation too

### Frontend (fliptripfront):
- `74bcb14` - FIX: Stop loading spinner after itinerary is loaded
- `bf9b8bc` - FIX: Improve error handling in SuccessPage verification
- `2e4fa16` - FIX: Prevent regeneration when loading full plan after payment
- `63be9bb` - FIX: Success page URL and prevent regeneration after payment
- `dab029c` - FIX: Remove automatic API calls to prevent unnecessary costs
- `c2914ce` - FIX: Remove duplicate City field from EditTourPage
- `d767fd5` - REMOVE: Country field from tour creation and editing forms

## 🚀 Инструкция по восстановлению

### 1. Клонирование репозиториев:
```bash
git clone https://github.com/YesEugene/fliptripback.git
git clone https://github.com/YesEugene/fliptripfront.git
```

### 2. Backend настройка:
```bash
cd fliptripback
npm install
```

Настроить переменные окружения в Vercel (см. раздел "Переменные окружения")

### 3. Frontend настройка:
```bash
cd fliptripfront
npm install
```

Создать `.env`:
```
VITE_API_URL=https://fliptripback.vercel.app
```

### 4. База данных:
1. Зайти в Supabase
2. Выполнить SQL схемы из `database/schema-*.sql`
3. Проверить переменные окружения Supabase

### 5. Деплой:
- Backend: автоматический через Vercel (GitHub integration)
- Frontend: автоматический через Vercel (GitHub integration)

## ⚠️ Важные замечания

1. **Не генерировать автоматически:** 
   - ItineraryPage не генерирует маршрут автоматически при загрузке
   - Генерация только при явном параметре city из HomePage

2. **Не вызывать OpenAI автоматически:**
   - Tag suggestions не генерируются автоматически
   - Только по явному действию пользователя

3. **Полный план не регенерируется:**
   - После оплаты загружается из Redis
   - Не вызывается smart-itinerary повторно

4. **Обработка ошибок Google Places:**
   - Ошибки не ломают процесс
   - Используется fallback локация

5. **URL должны быть flip-trip.com:**
   - Не использовать fliptripfront.vercel.app в production
   - Все редиректы на flip-trip.com

## 📞 Контакты и поддержка

- Backend репозиторий: https://github.com/YesEugene/fliptripback
- Frontend репозиторий: https://github.com/YesEugene/fliptripfront
- Production URL: https://flip-trip.com
- Backend URL: https://fliptripback.vercel.app

---

**Дата создания документа:** 16 декабря 2024  
**Версия системы:** v2.0 Production Ready  
**Статус:** ✅ Все работает стабильно

