# Анализ проблемы с сохранением профиля креатора

## Проблема

При попытке сохранить профиль в личном кабинете креатора возникает ошибка:

```
Profile check error: {
  code: '42703',
  details: null,
  hint: null,
  message: 'column guides.user_id does not exist'
}
```

**Ошибка `42703`** в PostgreSQL означает, что колонка не существует в таблице.

## Анализ кода

### 1. Структура таблицы `guides`

Из анализа кода создания записей в таблице `guides`:

**`admin-users.js` (строка 202-208):**
```javascript
// Based on auth-register.js, guides table uses 'id' column, not 'user_id'
const { error: guideError } = await supabase
  .from('guides')
  .insert({
    id: userId, // Use id column (same as user id)
    name: name || email.split('@')[0] || 'Guide'
  });
```

**`auth-register.js` (строка 105-110):**
```javascript
if (userRole === 'guide') {
  await supabase
    .from('guides')
    .insert({
      id: userId,
      name: name
    });
}
```

**Вывод:** Таблица `guides` использует колонку `id` (которая совпадает с `users.id`), а **НЕ** `user_id`.

### 2. Проблемный код в `guide-profile.js`

В файле `guide-profile.js` используется колонка `user_id`, которой не существует:

**Строка 95 (GET запрос):**
```javascript
const { data: guideProfile, error: profileError } = await supabase
  .from('guides')
  .select('*')
  .eq('user_id', userId)  // ❌ ОШИБКА: колонка user_id не существует
  .single();
```

**Строка 152 (PUT запрос - создание):**
```javascript
const guideData = {
  user_id: userId,  // ❌ ОШИБКА: колонка user_id не существует
  name: profileData.name || user.email?.split('@')[0] || 'Guide',
  // ...
};
```

**Строка 175 (PUT запрос - проверка существования):**
```javascript
const { data: existingGuide, error: checkError } = await supabase
  .from('guides')
  .select('id')
  .eq('user_id', userId)  // ❌ ОШИБКА: колонка user_id не существует
  .maybeSingle();
```

**Строка 197 (PUT запрос - обновление):**
```javascript
const { data: updatedGuide, error: updateError } = await supabase
  .from('guides')
  .update(updateData)
  .eq('user_id', userId)  // ❌ ОШИБКА: колонка user_id не существует
  .select()
  .single();
```

## Правильная структура

Таблица `guides` имеет следующую структуру:
- `id` (uuid, primary key) - совпадает с `users.id`
- `name` (varchar)
- `bio` (text, nullable)
- `avatar_url` (varchar, nullable)
- `instagram` (varchar, nullable)
- `facebook` (varchar, nullable)
- `twitter` (varchar, nullable)
- `linkedin` (varchar, nullable)
- `website` (varchar, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**НЕТ колонки `user_id`!**

## Решение

Заменить все использования `user_id` на `id` в `guide-profile.js`:

1. **GET запрос (строка 95):**
   ```javascript
   // Было:
   .eq('user_id', userId)
   
   // Должно быть:
   .eq('id', userId)
   ```

2. **PUT запрос - создание (строка 152):**
   ```javascript
   // Было:
   const guideData = {
     user_id: userId,
     // ...
   };
   
   // Должно быть:
   const guideData = {
     id: userId,  // id совпадает с users.id
     // ...
   };
   ```

3. **PUT запрос - проверка существования (строка 175):**
   ```javascript
   // Было:
   .eq('user_id', userId)
   
   // Должно быть:
   .eq('id', userId)
   ```

4. **PUT запрос - обновление (строка 197):**
   ```javascript
   // Было:
   .eq('user_id', userId)
   
   // Должно быть:
   .eq('id', userId)
   ```

5. **PUT запрос - удаление user_id из updateData (строка 192):**
   ```javascript
   // Было:
   delete updateData.user_id;
   
   // Должно быть:
   delete updateData.id;  // Не обновляем id при обновлении существующей записи
   ```

6. **PUT запрос - проверка на null (строка 166):**
   ```javascript
   // Было:
   if (guideData[key] === null && key !== 'user_id' && key !== 'name') {
   
   // Должно быть:
   if (guideData[key] === null && key !== 'id' && key !== 'name') {
   ```

## Дополнительные проверки

Также найдены другие файлы, которые используют `guides.user_id`:

### `api/tours.js`

**Строка 164 (GET single tour):**
```javascript
const { data: guide } = await supabase
  .from('guides')
  .select('id, name, avatar_url')
  .eq('user_id', tour.guide_id)  // ❌ ОШИБКА: колонка user_id не существует
  .maybeSingle();
```

**Строка 425 (GET list of tours):**
```javascript
const { data: guide } = await supabase
  .from('guides')
  .select('id, name, avatar_url')
  .eq('user_id', tour.guide_id)  // ❌ ОШИБКА: колонка user_id не существует
  .maybeSingle();
```

**Исправление:**
```javascript
// Должно быть:
.eq('id', tour.guide_id)  // id совпадает с users.id, а tour.guide_id = users.id
```

**Логика:** `tour.guide_id` содержит `users.id`, который совпадает с `guides.id`, поэтому нужно использовать `.eq('id', tour.guide_id)`.

## Выводы

1. **Основная проблема:** Несоответствие структуры таблицы `guides` и кода в `guide-profile.js`
2. **Причина:** Таблица использует `id` (совпадает с `users.id`), а код пытается использовать несуществующую колонку `user_id`
3. **Решение:** Заменить все `user_id` на `id` в `guide-profile.js`
4. **Согласованность:** Код должен соответствовать структуре, используемой в `admin-users.js` и `auth-register.js`

