# Предложение по интеграции Google Places Autocomplete

## Текущая ситуация

В системе уже используется Google Places API на backend для поиска локаций при генерации туров. Однако для формы создания локации креатором нужен Autocomplete для удобного выбора локаций.

## Варианты решения

### Вариант 1: Google Places Autocomplete на фронте (простой, но требует API ключ на фронте)

**Плюсы:**
- Простая реализация
- Быстрая работа (запросы идут напрямую с фронта)
- Не нагружает backend

**Минусы:**
- API ключ будет виден на фронте (но можно ограничить по домену в Google Console)
- Нужно настроить ограничения по домену в Google Cloud Console

**Реализация:**
1. Добавить Google Places Autocomplete библиотеку на фронт
2. Настроить API ключ с ограничениями по домену
3. При выборе места из autocomplete - получить place_id
4. Вызвать Places Details API для получения полной информации
5. Автозаполнить поля: название, адрес, сайт, booking_url

**Код:**
```javascript
// В CreateTourPage.jsx добавить:
import { Loader } from '@googlemaps/js-api-loader';

// При инициализации:
const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places']
});

// В поле Location Name добавить autocomplete:
const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
  types: ['establishment'],
  fields: ['place_id', 'name', 'formatted_address', 'website', 'url']
});

autocomplete.addListener('place_changed', () => {
  const place = autocomplete.getPlace();
  // Заполнить поля формы
});
```

### Вариант 2: Backend endpoint для Google Places (безопаснее, но сложнее)

**Плюсы:**
- API ключ скрыт на backend
- Можно добавить кэширование
- Единая точка обработки ошибок

**Минусы:**
- Нужен дополнительный backend endpoint
- Больше запросов к backend

**Реализация:**
1. Создать endpoint `/api/google-places/autocomplete` для поиска
2. Создать endpoint `/api/google-places/details` для получения деталей
3. На фронте делать запросы к этим endpoint'ам

## Рекомендация

**Рекомендую Вариант 1** (Google Places Autocomplete на фронте), так как:
- Это стандартный подход Google
- Проще в реализации
- Быстрее работает
- API ключ можно защитить ограничениями по домену в Google Cloud Console

## Что нужно сделать

1. Получить Google Maps API ключ с включенными:
   - Places API
   - Places API (New)
   - Maps JavaScript API

2. Настроить ограничения по домену:
   - В Google Cloud Console → API & Services → Credentials
   - Добавить ограничение "HTTP referrers" с доменами:
     - `https://flip-trip.com/*`
     - `https://www.flip-trip.com/*`
     - `https://fliptripfrontend.vercel.app/*`
     - `http://localhost:5173/*` (для разработки)

3. Добавить переменную окружения на фронте:
   - `VITE_GOOGLE_MAPS_API_KEY=your_api_key`

4. Установить библиотеку:
   ```bash
   npm install @googlemaps/js-api-loader
   ```

5. Интегрировать в форму создания локации

## Альтернатива (если нет API ключа)

Если нет возможности получить Google Maps API ключ, можно использовать простой поиск по названию с подсказками из базы данных (похоже на то, как работает поиск тегов).


