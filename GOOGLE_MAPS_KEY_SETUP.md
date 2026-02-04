# Настройка Google Maps API Key для Backend

## Проблема

Если вы видите ошибку **"Google Maps API key not configured"** при использовании функции "Find on Google Maps" в визуалайзере, это означает, что переменная окружения `GOOGLE_MAPS_KEY` не настроена в Vercel для backend проекта.

## Решение

### 1. Получите Google Maps API ключ

Если у вас уже есть ключ (используется для фронтенда как `VITE_GOOGLE_MAPS_KEY`), используйте тот же ключ. Если нет:

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Перейдите в **APIs & Services** → **Credentials**
4. Нажмите **Create Credentials** → **API Key**
5. Скопируйте созданный ключ

### 2. Включите необходимые API

В Google Cloud Console включите следующие API:
- **Places API** (обязательно для поиска локаций)
- **Places API (New)** (рекомендуется)
- **Maps JavaScript API** (для карт на фронтенде)
- **Geocoding API** (для преобразования адресов)

### 3. Добавьте ключ в Vercel Backend

1. Откройте проект на [Vercel](https://vercel.com/)
2. Выберите проект **fliptrip_backend** (backend проект)
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте новую переменную:
   - **Name:** `GOOGLE_MAPS_KEY`
   - **Value:** ваш Google Maps API ключ
   - **Environment:** выберите все окружения (Production, Preview, Development)
5. Нажмите **Save**

### 4. Перезапустите деплой

После добавления переменной окружения:
1. Перейдите в **Deployments**
2. Найдите последний деплой
3. Нажмите **Redeploy** (или просто сделайте новый коммит в git)

### 5. Проверьте настройки ключа в Google Cloud Console

1. Откройте ваш API ключ в Google Cloud Console
2. В разделе **Application restrictions** выберите **HTTP referrers (web sites)**
3. Добавьте домены:
   - `flip-trip.com/*`
   - `www.flip-trip.com/*`
   - `*.vercel.app/*`
   - `localhost:3000/*` (для разработки)
4. В разделе **API restrictions** выберите **Restrict key**
5. Выберите только необходимые API:
   - Places API
   - Places API (New)
   - Maps JavaScript API
   - Geocoding API
6. Сохраните изменения

## Важные замечания

- **Используйте один и тот же ключ** для фронтенда (`VITE_GOOGLE_MAPS_KEY`) и бэкенда (`GOOGLE_MAPS_KEY`)
- **Включите биллинг** в Google Cloud Console, если вы превысили бесплатный лимит ($200/месяц)
- **Проверьте квоты** в Google Cloud Console → APIs & Services → Dashboard

## Проверка

После настройки:
1. Откройте визуалайзер тура
2. Отредактируйте блок "Локация"
3. Нажмите "Find on Google Maps"
4. Попробуйте найти локацию - ошибка должна исчезнуть

## Отладка

Если ошибка сохраняется:
1. Проверьте логи в Vercel Dashboard → Logs
2. Убедитесь, что переменная `GOOGLE_MAPS_KEY` присутствует в Environment Variables
3. Проверьте, что деплой был перезапущен после добавления переменной
4. Проверьте, что API ключ активен в Google Cloud Console
