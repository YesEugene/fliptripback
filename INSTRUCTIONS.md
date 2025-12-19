# Инструкция по обогащению туров

## Проблема
Endpoint `/api/enrich-tours` еще не задеплоился на Vercel (возвращает 404).

## Решение

### Вариант 1: Подождать деплоя (рекомендуется)
1. Подождите 5-10 минут после последнего push
2. Вызовите endpoint:
   ```bash
   curl -X POST "https://fliptripbackend.vercel.app/api/enrich-tours" \
     -H "Content-Type: application/json" \
     -H "Origin: https://flip-trip.com" \
     -d '{}'
   ```

### Вариант 2: Использовать существующий endpoint
Endpoint `generate-sample-tours.js` уже обновляет существующие туры, но данные там неполные (по 2 локации).

**Чтобы обновить данные:**
1. Откройте файл `/api/generate-sample-tours.js`
2. Замените данные туров на полные из файла `/api/enrich-tours.js` (строки 12-233)
3. Закоммитьте и запушьте изменения
4. Подождите деплоя
5. Вызовите: `POST /api/generate-sample-tours`

### Вариант 3: Локальный скрипт (если есть доступ к переменным)
Если у вас есть `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`:
```bash
cd /Users/yes/Downloads/FlipTrip/fliptrip-clean-backend
node scripts/enrich-all-tours.js
```

## Проверка результата
После обновления проверьте в Supabase SQL Editor:
```sql
SELECT t.title, 
       COUNT(DISTINCT td.id) as days,
       COUNT(DISTINCT tb.id) as blocks,
       COUNT(DISTINCT ti.id) as items
FROM tours t
LEFT JOIN tour_days td ON td.tour_id = t.id
LEFT JOIN tour_blocks tb ON tb.tour_day_id = td.id
LEFT JOIN tour_items ti ON ti.tour_block_id = tb.id
WHERE t.is_published = true
GROUP BY t.id, t.title
ORDER BY t.title;
```

Ожидаемый результат: каждый тур должен иметь 6-8 локаций (items).


