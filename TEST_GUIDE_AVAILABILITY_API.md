# Тестирование API системы управления доступностью

## Предварительные требования

1. ✅ Миграция базы данных выполнена успешно
2. ✅ Backend развернут и доступен
3. ✅ У вас есть токен авторизации (из кабинета гида)

## Получение токена авторизации

1. Войдите в кабинет гида на сайте
2. Откройте DevTools (F12) → Console
3. Выполните:
```javascript
localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
```
4. Скопируйте токен

## Тест 1: Получение доступности дат для тура

### Запрос:
```bash
curl -X GET "https://fliptripbackend.vercel.app/api/guide-availability?tour_id=YOUR_TOUR_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Ожидаемый ответ:
```json
{
  "success": true,
  "availability": [
    {
      "id": "uuid",
      "date": "2025-12-22",
      "max_group_size": 10,
      "booked_spots": 0,
      "available_spots": 10,
      "is_available": true,
      "is_blocked": false,
      "custom_price": null,
      "notes": null
    }
  ]
}
```

## Тест 2: Создание слотов доступности

### Запрос:
```bash
curl -X POST "https://fliptripbackend.vercel.app/api/guide-availability" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tour_id": "YOUR_TOUR_ID",
    "slots": [
      {
        "date": "2025-12-22",
        "max_group_size": 10,
        "is_available": true,
        "is_blocked": false
      },
      {
        "date": "2025-12-23",
        "max_group_size": 15,
        "is_available": true,
        "is_blocked": false,
        "custom_price": 850
      }
    ]
  }'
```

### Ожидаемый ответ:
```json
{
  "success": true,
  "message": "Availability slots updated",
  "updated_count": 2,
  "slots": [...]
}
```

## Тест 3: Массовая блокировка дат

### Запрос:
```bash
curl -X POST "https://fliptripbackend.vercel.app/api/guide-availability" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tour_id": "YOUR_TOUR_ID",
    "bulk_block": {
      "dates": ["2025-12-25", "2025-12-26"],
      "is_blocked": true
    }
  }'
```

## Тест 4: Создание бронирования

### Запрос:
```bash
curl -X POST "https://fliptripbackend.vercel.app/api/tour-bookings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tour_id": "YOUR_TOUR_ID",
    "tour_date": "2025-12-22",
    "group_size": 2,
    "participants": [
      {
        "name": "John Doe",
        "email": "john@example.com"
      }
    ],
    "additional_services": {
      "photography": true,
      "food": false
    },
    "customer_notes": "We are vegetarian"
  }'
```

### Ожидаемый ответ:
```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "tour_id": "uuid",
    "tour_date": "2025-12-22",
    "group_size": 2,
    "total_price": 1590,
    "status": "pending",
    "payment_status": "pending"
  }
}
```

## Тест 5: Получение списка бронирований

### Запрос (для гида):
```bash
curl -X GET "https://fliptripbackend.vercel.app/api/tour-bookings?guide_id=YOUR_GUIDE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Запрос (для клиента):
```bash
curl -X GET "https://fliptripbackend.vercel.app/api/tour-bookings?user_id=YOUR_USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Тест 6: Обновление бронирования (подтверждение гидом)

### Запрос:
```bash
curl -X PUT "https://fliptripbackend.vercel.app/api/tour-bookings?booking_id=BOOKING_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "guide_notes": "Confirmed, meeting at 9:00 AM"
  }'
```

## Тест 7: Отмена бронирования

### Запрос:
```bash
curl -X DELETE "https://fliptripbackend.vercel.app/api/tour-bookings?booking_id=BOOKING_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancellation_reason": "Customer request"
  }'
```

## Проверка автоматического обновления booked_spots

После создания бронирования проверьте, что `booked_spots` обновился:

```bash
# Получить доступность снова
curl -X GET "https://fliptripbackend.vercel.app/api/guide-availability?tour_id=YOUR_TOUR_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Должно показать:
- `booked_spots: 2` (если забронировали 2 места)
- `available_spots: 8` (если max_group_size = 10)

## Тестирование через браузер (DevTools)

### В консоли браузера:

```javascript
// 1. Получить доступность
const token = localStorage.getItem('authToken');
const tourId = 'YOUR_TOUR_ID';

fetch(`https://fliptripbackend.vercel.app/api/guide-availability?tour_id=${tourId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log);

// 2. Создать слоты
fetch('https://fliptripbackend.vercel.app/api/guide-availability', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tour_id: tourId,
    slots: [
      { date: '2025-12-22', max_group_size: 10, is_available: true, is_blocked: false },
      { date: '2025-12-23', max_group_size: 10, is_available: true, is_blocked: false }
    ]
  })
})
.then(r => r.json())
.then(console.log);
```

## Возможные ошибки и решения

### Ошибка 401: Unauthorized
- Проверьте, что токен правильный
- Убедитесь, что токен передается в заголовке `Authorization: Bearer TOKEN`

### Ошибка 403: Forbidden
- Убедитесь, что вы владелец тура (guide_id совпадает с вашим user_id)

### Ошибка 404: Tour not found
- Проверьте, что tour_id правильный
- Убедитесь, что тур существует в базе данных

### Ошибка 400: Not enough spots available
- Проверьте, что на дату есть свободные места
- Убедитесь, что group_size не превышает available_spots

## Чеклист тестирования

- [ ] GET /api/guide-availability - получение доступности работает
- [ ] POST /api/guide-availability - создание слотов работает
- [ ] POST /api/guide-availability (bulk_block) - массовая блокировка работает
- [ ] POST /api/tour-bookings - создание бронирования работает
- [ ] GET /api/tour-bookings - получение списка бронирований работает
- [ ] PUT /api/tour-bookings - обновление бронирования работает
- [ ] DELETE /api/tour-bookings - отмена бронирования работает
- [ ] Проверено автоматическое обновление booked_spots после бронирования
- [ ] Проверено автоматическое обновление booked_spots после отмены

