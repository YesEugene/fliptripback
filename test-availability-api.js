/**
 * Тестовый скрипт для проверки API системы управления доступностью
 * Запуск: node test-availability-api.js
 * 
 * Требуется:
 * - TOKEN: токен авторизации (из localStorage браузера)
 * - TOUR_ID: ID тура с гидом (default_format = 'with_guide')
 * - GUIDE_ID: ID гида (user_id)
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://fliptripbackend.vercel.app';
const TOKEN = process.env.TOKEN || 'YOUR_TOKEN_HERE';
const TOUR_ID = process.env.TOUR_ID || 'YOUR_TOUR_ID_HERE';
const GUIDE_ID = process.env.GUIDE_ID || 'YOUR_GUIDE_ID_HERE';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function testAPI() {
  console.log('🧪 Начинаем тестирование API системы управления доступностью\n');

  // Тест 1: Получение доступности
  console.log('📋 Тест 1: Получение доступности дат для тура');
  try {
    const response = await fetch(`${API_BASE_URL}/api/guide-availability?tour_id=${TOUR_ID}`, {
      headers
    });
    const data = await response.json();
    console.log('✅ Результат:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('');
  }

  // Тест 2: Создание слотов доступности
  console.log('📋 Тест 2: Создание слотов доступности');
  try {
    const response = await fetch(`${API_BASE_URL}/api/guide-availability`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tour_id: TOUR_ID,
        slots: [
          {
            date: '2025-12-22',
            max_group_size: 10,
            is_available: true,
            is_blocked: false
          },
          {
            date: '2025-12-23',
            max_group_size: 15,
            is_available: true,
            is_blocked: false
          }
        ]
      })
    });
    const data = await response.json();
    console.log('✅ Результат:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('');
  }

  // Тест 3: Массовая блокировка дат
  console.log('📋 Тест 3: Массовая блокировка дат');
  try {
    const response = await fetch(`${API_BASE_URL}/api/guide-availability`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tour_id: TOUR_ID,
        bulk_block: {
          dates: ['2025-12-25', '2025-12-26'],
          is_blocked: true
        }
      })
    });
    const data = await response.json();
    console.log('✅ Результат:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('');
  }

  // Тест 4: Создание бронирования
  console.log('📋 Тест 4: Создание бронирования');
  let bookingId = null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/tour-bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tour_id: TOUR_ID,
        tour_date: '2025-12-22',
        group_size: 2,
        participants: [
          {
            name: 'Test User',
            email: 'test@example.com'
          }
        ],
        additional_services: {
          photography: true,
          food: false
        },
        customer_notes: 'Test booking'
      })
    });
    const data = await response.json();
    console.log('✅ Результат:', JSON.stringify(data, null, 2));
    if (data.success && data.booking) {
      bookingId = data.booking.id;
    }
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('');
  }

  // Тест 5: Получение списка бронирований
  console.log('📋 Тест 5: Получение списка бронирований');
  try {
    const response = await fetch(`${API_BASE_URL}/api/tour-bookings?guide_id=${GUIDE_ID}`, {
      headers
    });
    const data = await response.json();
    console.log('✅ Результат:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('');
  }

  // Тест 6: Проверка обновления booked_spots
  if (bookingId) {
    console.log('📋 Тест 6: Проверка обновления booked_spots после бронирования');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guide-availability?tour_id=${TOUR_ID}`, {
        headers
      });
      const data = await response.json();
      const slot = data.availability?.find(s => s.date === '2025-12-22');
      if (slot) {
        console.log(`✅ Дата 2025-12-22: booked_spots=${slot.booked_spots}, available_spots=${slot.available_spots}`);
      }
      console.log('');
    } catch (error) {
      console.error('❌ Ошибка:', error.message);
      console.log('');
    }

    // Тест 7: Отмена бронирования
    console.log('📋 Тест 7: Отмена бронирования');
    try {
      const response = await fetch(`${API_BASE_URL}/api/tour-bookings?booking_id=${bookingId}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          cancellation_reason: 'Test cancellation'
        })
      });
      const data = await response.json();
      console.log('✅ Результат:', JSON.stringify(data, null, 2));
      console.log('');
    } catch (error) {
      console.error('❌ Ошибка:', error.message);
      console.log('');
    }

    // Тест 8: Проверка обновления booked_spots после отмены
    console.log('📋 Тест 8: Проверка обновления booked_spots после отмены');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guide-availability?tour_id=${TOUR_ID}`, {
        headers
      });
      const data = await response.json();
      const slot = data.availability?.find(s => s.date === '2025-12-22');
      if (slot) {
        console.log(`✅ Дата 2025-12-22: booked_spots=${slot.booked_spots}, available_spots=${slot.available_spots}`);
        if (slot.booked_spots === 0) {
          console.log('✅ ✅ ✅ booked_spots успешно обновился после отмены!');
        }
      }
      console.log('');
    } catch (error) {
      console.error('❌ Ошибка:', error.message);
      console.log('');
    }
  }

  console.log('🏁 Тестирование завершено');
}

// Запуск тестов
if (TOKEN === 'YOUR_TOKEN_HERE' || TOUR_ID === 'YOUR_TOUR_ID_HERE') {
  console.error('❌ Пожалуйста, установите переменные окружения:');
  console.error('   TOKEN=your_token TOUR_ID=your_tour_id GUIDE_ID=your_guide_id node test-availability-api.js');
  console.error('   или отредактируйте файл и установите значения напрямую');
  process.exit(1);
}

testAPI().catch(console.error);

