# План реализации фильтрации по категориям через location_interests

## Требования

1. **Использовать `location_interests`**: Туры содержат локации, локации связаны с интересами через `location_interests`
2. **Выбор категории = все интересы категории**: При выборе категории "Active" подразумеваются все интересы этой категории (adventure sports, extreme sports, climbing, cycling, hiking и т.д.)
3. **Множественный выбор категорий**: Можно выбрать несколько категорий одновременно (например, Active + Food)
4. **Конкретные интересы**: Можно выбрать конкретные интересы в дополнение к категориям

## Логика фильтрации

### Сценарии:

1. **Только категории**: Выбраны "Active" и "Food"
   - → Все интересы из "Active" + все интересы из "Food"
   - → Фильтровать туры, у которых хотя бы одна локация имеет хотя бы один из этих интересов

2. **Категории + конкретные интересы**: Выбраны "Active" + конкретный интерес "yoga" (из категории "Health")
   - → Все интересы из "Active" + "yoga"
   - → Фильтровать туры, у которых хотя бы одна локация имеет хотя бы один из этих интересов

3. **Только конкретные интересы**: Выбраны только конкретные интересы (без категорий)
   - → Только эти интересы
   - → Фильтровать туры, у которых хотя бы одна локация имеет хотя бы один из этих интересов

## Реализация

### Backend (api/tours.js)

#### Шаг 1: Изменить запрос для загрузки location_interests

Текущий запрос:
```javascript
.select(`
  *,
  city:cities(name),
  tour_tags(
    tag:tags(id, name)
  )
`)
```

Новый запрос:
```javascript
.select(`
  *,
  city:cities(name),
  tour_tags(
    tag:tags(id, name)
  ),
  tour_days(
    tour_blocks(
      tour_items(
        location:locations(
          id,
          name,
          location_interests(
            interest:interests(
              id,
              name,
              category_id
            )
          )
        )
      )
    )
  )
`)
```

#### Шаг 2: Изменить логику фильтрации

Текущая логика (строки 192-197):
```javascript
if (interests) {
  const interestList = Array.isArray(interests) ? interests : interests.split(',');
  filteredTours = filteredTours.filter(t => {
    const tourTagNames = (t.tour_tags || []).map(tt => tt.tag?.name).filter(Boolean);
    return interestList.some(interest => tourTagNames.includes(interest));
  });
}
```

Новая логика:
```javascript
if (interests) {
  const interestList = Array.isArray(interests) ? interests : interests.split(',');
  filteredTours = filteredTours.filter(t => {
    // Собираем все интересы из всех локаций тура
    const tourLocationInterests = new Set();
    
    if (t.tour_days && Array.isArray(t.tour_days)) {
      t.tour_days.forEach(day => {
        if (day.tour_blocks && Array.isArray(day.tour_blocks)) {
          day.tour_blocks.forEach(block => {
            if (block.tour_items && Array.isArray(block.tour_items)) {
              block.tour_items.forEach(item => {
                if (item.location && item.location.location_interests) {
                  item.location.location_interests.forEach(li => {
                    if (li.interest && li.interest.name) {
                      tourLocationInterests.add(li.interest.name.toLowerCase());
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
    
    // Проверяем, есть ли хотя бы один интерес из списка фильтра
    return interestList.some(interest => 
      tourLocationInterests.has(interest.toLowerCase())
    );
  });
}
```

### Frontend (HomePage.jsx)

#### Шаг 1: Изменить состояние для множественного выбора категорий

Текущее:
```javascript
const [quickFilterSelectedCategory, setQuickFilterSelectedCategory] = useState(null);
```

Новое:
```javascript
const [quickFilterSelectedCategories, setQuickFilterSelectedCategories] = useState([]); // Массив ID категорий
```

#### Шаг 2: Изменить логику сбора интересов для фильтрации

Текущая логика (строки 236-248):
```javascript
// Quick filters: apply category if selected (real-time filtering)
if (quickFilterSelectedCategory && interestsStructure) {
  const category = interestsStructure.find(c => c.id === quickFilterSelectedCategory);
  if (category) {
    const categoryInterests = allInterests.filter(i => i.category_id === category.id);
    if (categoryInterests.length > 0) {
      const interestNames = categoryInterests.map(i => i.name).filter(Boolean);
      if (interestNames.length > 0) {
        filters.interests = interestNames;
      }
    }
  }
}
```

Новая логика:
```javascript
// Quick filters: apply categories and specific interests
const selectedInterestNames = new Set();

// 1. Добавляем все интересы из выбранных категорий
if (quickFilterSelectedCategories.length > 0 && interestsStructure && allInterests.length > 0) {
  quickFilterSelectedCategories.forEach(categoryId => {
    const categoryInterests = allInterests.filter(i => i.category_id === categoryId);
    categoryInterests.forEach(interest => {
      if (interest.name) {
        selectedInterestNames.add(interest.name);
      }
    });
  });
}

// 2. Добавляем конкретные выбранные интересы (если есть)
if (formData.interest_ids && formData.interest_ids.length > 0 && allInterests.length > 0) {
  formData.interest_ids.forEach(interestId => {
    const interest = allInterests.find(i => i.id === interestId);
    if (interest && interest.name) {
      selectedInterestNames.add(interest.name);
    }
  });
}

// 3. Применяем фильтр, если есть выбранные интересы
if (selectedInterestNames.size > 0) {
  filters.interests = Array.from(selectedInterestNames);
}
```

#### Шаг 3: Обновить UI для множественного выбора категорий

Текущая кнопка (строки 968-999):
```javascript
<button
  onClick={() => {
    setQuickFilterCategoryOpen(!quickFilterCategoryOpen);
    setQuickFilterDateOpen(false);
    setQuickFilterBudgetOpen(false);
  }}
>
  <span>Category</span>
  {quickFilterSelectedCategory && ...}
</button>
```

Новая кнопка:
```javascript
<button
  onClick={() => {
    setQuickFilterCategoryOpen(!quickFilterCategoryOpen);
    setQuickFilterDateOpen(false);
    setQuickFilterBudgetOpen(false);
  }}
>
  <span>Category</span>
  {quickFilterSelectedCategories.length > 0 && (
    <span>({quickFilterSelectedCategories.length})</span>
  )}
</button>
```

Новый dropdown (строки 1078-1131):
```javascript
{quickFilterCategoryOpen && interestsStructure && interestsStructure.length > 0 && (
  <div>
    {interestsStructure.map(category => {
      const isSelected = quickFilterSelectedCategories.includes(category.id);
      return (
        <button
          key={category.id}
          onClick={() => {
            if (isSelected) {
              // Удаляем категорию
              setQuickFilterSelectedCategories(prev => 
                prev.filter(id => id !== category.id)
              );
            } else {
              // Добавляем категорию
              setQuickFilterSelectedCategories(prev => [...prev, category.id]);
            }
            // Не закрываем dropdown, чтобы можно было выбрать несколько
          }}
        >
          {category.icon} {CATEGORY_NAMES[category.name] || category.name}
        </button>
      );
    })}
  </div>
)}
```

#### Шаг 4: Обновить зависимости useEffect

Текущее (строка 300):
```javascript
}, [formData.city, formData.interest_ids, formData.budget, selectedDates, allInterests, quickFilterSelectedCategory, interestsStructure]);
```

Новое:
```javascript
}, [formData.city, formData.interest_ids, formData.budget, selectedDates, allInterests, quickFilterSelectedCategories, interestsStructure]);
```

#### Шаг 5: Обновить handleResetFilters

Текущее (строка 397):
```javascript
setQuickFilterSelectedCategory(null);
```

Новое:
```javascript
setQuickFilterSelectedCategories([]);
```

## Порядок реализации

1. ✅ Создать план (этот документ)
2. ⬜ Изменить backend запрос для загрузки location_interests
3. ⬜ Изменить backend логику фильтрации
4. ⬜ Изменить frontend состояние для множественного выбора
5. ⬜ Изменить frontend логику сбора интересов
6. ⬜ Обновить UI для множественного выбора
7. ⬜ Обновить зависимости и сброс фильтров
8. ⬜ Тестирование

## Важные моменты

1. **Производительность**: Загрузка всех location_interests для всех туров может быть тяжелой операцией. Возможно, потребуется оптимизация (например, загружать только при необходимости фильтрации).

2. **Регистр**: Использовать `.toLowerCase()` для сравнения имен интересов, чтобы избежать проблем с регистром.

3. **Пустые значения**: Проверять наличие данных на каждом уровне вложенности (tour_days, tour_blocks, tour_items, location, location_interests).

4. **Обратная совместимость**: Старая логика через tour_tags должна остаться как fallback или быть удалена после тестирования.

