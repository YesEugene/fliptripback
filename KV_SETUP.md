# Upstash Redis Setup Instructions

## Проблема
Vercel serverless functions имеют read-only файловую систему. JSON файлы не могут быть записаны в production.

## Решение
Используем **Upstash Redis** из Vercel Marketplace для хранения планов.

## Настройка

### 1. Создать Upstash Redis через Vercel Marketplace
1. Зайдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект `fliptrip-backend`
3. Перейдите в раздел **Storage**
4. Нажмите **Create Database**
5. В разделе **Marketplace Database Providers** найдите **Upstash**
6. Нажмите **Create** на карточке Upstash
7. Следуйте инструкциям для создания Redis базы (можно использовать бесплатный план)

### 2. Подключить Redis к проекту
1. После создания Upstash Redis, Vercel автоматически добавит переменные окружения:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

2. Эти переменные будут автоматически доступны в serverless functions

### 3. Проверить работу
После деплоя проверьте:
- Генерация плана сохраняется в Redis
- Загрузка плана по ID работает
- Полный план генерируется после оплаты

## Преимущества Upstash Redis
- ✅ Бесплатный tier доступен
- ✅ Serverless (платите только за использование)
- ✅ Автоматическая интеграция с Vercel
- ✅ Высокая производительность
- ✅ Простое API (совместимо с Redis)

