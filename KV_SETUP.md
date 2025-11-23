# Vercel KV Setup Instructions

## Проблема
Vercel serverless functions имеют read-only файловую систему. JSON файлы не могут быть записаны в production.

## Решение
Используем Vercel KV (Redis) для хранения планов.

## Настройка

### 1. Создать KV Database в Vercel
1. Зайдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект `fliptrip-backend`
3. Перейдите в раздел **Storage**
4. Нажмите **Create Database**
5. Выберите **KV** (Key-Value)
6. Создайте базу данных (можно использовать бесплатный план)

### 2. Подключить KV к проекту
1. После создания KV, Vercel автоматически добавит переменные окружения:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

2. Эти переменные будут автоматически доступны в serverless functions

### 3. Проверить работу
После деплоя проверьте:
- Генерация плана сохраняется в KV
- Загрузка плана по ID работает
- Полный план генерируется после оплаты

## Альтернативы (если KV не подходит)
- **Vercel Postgres** - реляционная БД
- **MongoDB Atlas** - бесплатный tier
- **Supabase** - бесплатный tier
- **Upstash Redis** - альтернатива KV

