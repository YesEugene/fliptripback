# Анализ проблемы фильтрации по категориям

## Проблема
- Фильтрация работает только для категории "Active" (находится 1 тур)
- Для других категорий не находится ни одного тура, хотя в каждой категории много интересов
- Нужна возможность выбирать несколько категорий одновременно

## Текущая логика фильтрации

### Frontend (HomePage.jsx, строки 236-248)
```javascript
// Quick filters: apply category if selected (real-time filtering)
if (quickFilterSelectedCategory && interestsStructure) {
  const category = interestsStructure.find(c => c.id === quickFilterSelectedCategory);
  if (category) {
    // Filter tours by category - get all interests from this category
    const categoryInterests = allInterests.filter(i => i.category_id === category.id);
    if (categoryInterests.length > 0) {
      const interestNames = categoryInterests.map(i => i.name).filter(Boolean);
      if (interestNames.length > 0) {
        filters.interests = interestNames; // Массив имен интересов
      }
    }
  }
}
```

**Что происходит:**
1. Выбирается категория (например, "Active")
2. Находятся все интересы из этой категории (например, "cycling", "hiking", "running")
3. Имена интересов отправляются в `filters.interests` как массив

### Backend API (api.js, строки 276-278)
```javascript
if (filters.interests && filters.interests.length > 0) {
  params.append('interests', filters.interests.join(',')); // Преобразуется в строку через запятую
}
```

**Что происходит:**
- Массив интересов преобразуется в строку: `"cycling,hiking,running"`

### Backend Filter (tours.js, строки 192-197)
```javascript
if (interests) {
  const interestList = Array.isArray(interests) ? interests : interests.split(',');
  filteredTours = filteredTours.filter(t => {
    const tourTagNames = (t.tour_tags || []).map(tt => tt.tag?.name).filter(Boolean);
    return interestList.some(interest => tourTagNames.includes(interest));
  });
}
```

**Что происходит:**
1. Строка интересов разбивается на массив: `["cycling", "hiking", "running"]`
2. Для каждого тура извлекаются имена тегов из `tour_tags`
3. Проверяется, есть ли хотя бы один интерес, который совпадает с именем тега тура

## Проблемы

### Проблема 1: Несоответствие имен
- **Интересы** имеют имена типа: `"cycling"`, `"hiking"`, `"running"`
- **Теги туров** могут иметь другие имена, например: `"Cycling"`, `"Cycling Adventure"`, `"Bike Tour"`
- Сравнение идет по точному совпадению (`includes`), поэтому не находит туры

### Проблема 2: Связь туров с интересами
- Туры связаны с интересами через **теги** (`tour_tags`), а не напрямую через `tour_interests`
- Нет гарантии, что имена тегов совпадают с именами интересов
- Возможно, нужно использовать `location_interests` через локации туров

### Проблема 3: Одна категория за раз
- Сейчас можно выбрать только одну категорию (`quickFilterSelectedCategory` - одно значение)
- Нужна возможность выбирать несколько категорий одновременно

## Решения

### Решение 1: Использовать `location_interests` вместо `tour_tags`
- Туры содержат локации (`tour_items` -> `locations`)
- Локации связаны с интересами через `location_interests`
- Нужно изменить логику фильтрации в backend, чтобы проверять интересы локаций туров

### Решение 2: Нормализовать имена
- Создать маппинг между именами интересов и тегов
- Или использовать ID интересов вместо имен

### Решение 3: Множественный выбор категорий
- Изменить `quickFilterSelectedCategory` с одного значения на массив
- При фильтрации объединять интересы из всех выбранных категорий

## Рекомендации

1. **Сначала проверить структуру данных:**
   - Какие теги есть у туров в базе данных?
   - Есть ли таблица `tour_interests`?
   - Как туры связаны с интересами на самом деле?

2. **Исправить логику фильтрации:**
   - Использовать `location_interests` для фильтрации
   - Или создать правильный маппинг между интересами и тегами

3. **Добавить множественный выбор категорий:**
   - Изменить состояние на массив категорий
   - Обновить UI для множественного выбора
   - Объединять интересы из всех выбранных категорий


