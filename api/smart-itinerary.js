// FlipTrip Clean Backend - Smart Itinerary Generator v2.0 PERFECT
// Модульная архитектура для генерации плана на день

import OpenAI from 'openai';
import { Client } from '@googlemaps/google-maps-services-js';

// Инициализация
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const googleMapsClient = new Client({});

// =============================================================================
// МОДУЛЬ 0: ГЕНЕРАЦИЯ КОНЦЕПЦИИ ДНЯ
// =============================================================================

async function generateDayConcept(city, audience, interests, date, budget) {
  console.log('🎨 МОДУЛЬ 0: Создание концепции дня...');
  
  const prompt = `You are a creative travel planner. Based on the input data (city, date, interests, audience, budget), create a full-day itinerary that runs from 9:00 AM to around 9:30 PM.

CONTEXT:
- City: ${city}
- Audience: ${audience}
- Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
- Budget: ${budget}€
- Date: ${date}

Step 1. Build a Creative Concept of the Day
• Take into account the city and what it has to offer.
• Consider the audience (solo traveler, couple, family with children, or kids) and adapt the tone of the day accordingly.
• Use the chosen interests to design a unique and memorable plan, with a balance between activities and meals across time slots (breakfast, lunch, dinner, snacks, activities, nightlife).
• Respect the budget: the total cost of all locations must fit within the user's budget, with a maximum deviation of ±30%. If the budget is small, include free or affordable activities; if large, suggest exclusive experiences.
• Enrich the interests with associative ideas (e.g. "sports" → running, cycling, gyms, outdoor activities, sports cafés).

Step 2. Formulate a Task for Google Places
Once the creative concept of the day is ready, translate each time slot into a structured request for Google Places API.

RESPONSE FORMAT (JSON only, no markdown):
{
  "concept": "Brief description of the day's creative theme/concept",
  "timeSlots": [
    {
      "time": "09:00",
      "activity": "Morning coffee at scenic viewpoint",
      "category": "cafe",
      "description": "Start with energizing coffee overlooking the city",
      "keywords": ["coffee", "viewpoint", "morning", "scenic", "local"],
      "budgetTier": "budget"
    }
  ]
}

Make it creative, locally relevant, and perfectly suited for ${audience} interested in ${Array.isArray(interests) ? interests.join(', ') : interests}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.8
    });

    const result = JSON.parse(response.choices[0].message.content.trim());
    console.log('✅ МОДУЛЬ 0: Концепция создана:', result.concept);
    return result;
  } catch (error) {
    console.error('❌ МОДУЛЬ 0: Ошибка создания концепции:', error.message);
    throw error;
  }
}

// =============================================================================
// МОДУЛЬ 1: ПОИСК РЕАЛЬНЫХ МЕСТ
// =============================================================================

async function findRealLocations(timeSlots, city) {
  console.log('📍 МОДУЛЬ 1: Поиск реальных мест...');
  
  const locations = [];
  
  for (const slot of timeSlots) {
    try {
      const searchQuery = `${slot.keywords.join(' ')} ${slot.category} in ${city}`;
      console.log(`🔍 Поиск: ${searchQuery}`);
      
      const response = await googleMapsClient.textSearch({
        params: {
          query: searchQuery,
          key: process.env.GOOGLE_MAPS_KEY,
          language: 'en'
        }
      });

      if (response.data.results.length > 0) {
        const place = response.data.results[0];
        
        // Получаем детальную информацию о месте, включая все фото
        let detailedPlace = place;
        if (place.place_id) {
          try {
            console.log(`📸 Получаем детали места: ${place.name}`);
            const detailsResponse = await googleMapsClient.placeDetails({
              params: {
                place_id: place.place_id,
                fields: ['photos', 'rating', 'price_level', 'formatted_address', 'name'],
                key: process.env.GOOGLE_MAPS_KEY
              }
            });
            detailedPlace = detailsResponse.data.result;
            console.log(`📸 Получено ${detailedPlace.photos?.length || 0} фото для ${place.name}`);
          } catch (detailError) {
            console.log(`⚠️ Не удалось получить детали для ${place.name}, используем базовые данные`);
          }
        }
        
        locations.push({
          ...slot,
          realPlace: {
            name: detailedPlace.name || place.name,
            address: detailedPlace.formatted_address || place.formatted_address,
            rating: detailedPlace.rating || place.rating || 4.0,
            priceLevel: detailedPlace.price_level || place.price_level || 2,
            photos: detailedPlace.photos || [] // Реальные фото заведения
          }
        });
        console.log(`✅ Найдено: ${place.name}`);
      } else {
        console.log(`⚠️ Место не найдено для: ${slot.activity}`);
        locations.push({
          ...slot,
          realPlace: {
            name: slot.activity,
            address: `${city} City Center`,
            rating: 4.0,
            priceLevel: 2,
            photos: []
          }
        });
      }
    } catch (error) {
      console.error(`❌ Ошибка поиска для ${slot.activity}:`, error.message);
      locations.push({
        ...slot,
        realPlace: {
          name: slot.activity,
          address: `${city} City Center`,
          rating: 4.0,
          priceLevel: 2,
          photos: []
        }
      });
    }
  }
  
  console.log(`✅ МОДУЛЬ 1: Найдено ${locations.length} мест`);
  return locations;
}

// =============================================================================
// МОДУЛЬ 2: ГЕНЕРАЦИЯ ОПИСАНИЙ ЛОКАЦИЙ
// =============================================================================

async function generateLocationDescription(locationName, address, category, interests, audience, concept) {
  console.log(`✍️ МОДУЛЬ 2: Генерация описания для ${locationName}...`);
  
  const prompt = `IMPORTANT: Write EXACTLY 3 complete sentences in English about this location.
Create a rich, immersive description that captures the essence, atmosphere, history, and unique character of the place.
Describe what makes this location special, what visitors will experience, feel, see, hear, and discover.
Include sensory details, emotional impact, and cultural significance.
Connect the description to the user's interests and the creative concept of the day.
Make it so vivid that the reader can almost be there.
REQUIREMENT: Your response must contain exactly 3 complete sentences with periods.

Location: ${locationName}
Address: ${address}
Category: ${category}
User interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Example Output:
Your afternoon unfolds at Marché des Enfants Rouges, Paris's oldest covered market, where centuries of culinary tradition come alive in a symphony of colors, aromas, and flavors. The moment you step inside, the bustling energy envelops you — vendors calling out their daily specials, the sizzle of fresh ingredients hitting hot pans, and the cheerful chatter of locals sharing their favorite discoveries. Here, food transcends mere sustenance to become a celebration of cultures from around the world, each stall telling its own story through authentic recipes passed down through generations. The market's historic iron and glass architecture creates a cathedral-like space where natural light filters through, illuminating displays of vibrant produce, artisanal cheeses, and exotic spices that awaken all your senses.

Create the description:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.8
    });

    const description = response.choices[0].message.content.trim();
    console.log(`✅ МОДУЛЬ 2: Описание создано для ${locationName}`);
    return description;
  } catch (error) {
    console.error(`❌ МОДУЛЬ 2: Ошибка описания для ${locationName}:`, error.message);
    return `Experience the authentic charm of ${locationName}, a beloved ${category} that captures the essence of ${city}. This location offers a perfect blend of local culture and unique atmosphere that resonates with ${audience}'s passion for ${Array.isArray(interests) ? interests.join(' and ') : interests}. The vibrant energy and distinctive character make it an unforgettable stop on your journey through the city. Every moment here connects you to the authentic spirit of the destination, creating memories that will last long after your visit ends.`;
  }
}

// =============================================================================
// МОДУЛЬ 3: ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ
// =============================================================================

async function generateLocationRecommendations(locationName, category, interests, audience, concept) {
  console.log(`💡 МОДУЛЬ 3: Генерация рекомендаций для ${locationName}...`);
  
  const prompt = `IMPORTANT: Write EXACTLY 1 complete sentence in English with practical tips for visiting this location.
Include specific advice about timing, what to order/see/do, or insider secrets that enhance the experience.
Make the tip personal, caring, and inspiring — like advice from a knowledgeable local friend.
Include practical details that connect to the user's interests and the creative concept of the day.
REQUIREMENT: Your response must be exactly 1 complete sentence with a period.

Location: ${locationName}
Category: ${category}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Example Output:
Start your day of adventure at this location by getting there early to savor their famed specialties, as the morning atmosphere provides the perfect energy and authentic local experience that perfectly matches your interests.

Create the tips:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.8
    });

    const tips = response.choices[0].message.content.trim();
    console.log(`✅ МОДУЛЬ 3: Рекомендации созданы для ${locationName}`);
    return tips;
  } catch (error) {
    console.error(`❌ МОДУЛЬ 3: Ошибка рекомендаций для ${locationName}:`, error.message);
    return `Plan to spend quality time at ${locationName} to fully appreciate its unique character and authentic atmosphere. Ask locals for their personal recommendations and insider tips - they're usually delighted to share their favorite aspects of this special place. Consider visiting during different times to experience various moods and energy levels that this location offers throughout the day.`;
  }
}

// =============================================================================
// МОДУЛЬ ФОТОГРАФИЙ: 4 фото для каждой локации
// =============================================================================

function generateLocationPhotos(place, category, locationName) {
  console.log(`📸 МОДУЛЬ ФОТО: Генерация фото для ${locationName}...`);
  
  const photos = [];
  
  // 1. Добавляем ВСЕ доступные фото из Google Places
  if (place.photos && place.photos.length > 0) {
    const googlePhotos = place.photos.map(photo => 
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
    );
    photos.push(...googlePhotos);
    console.log(`📸 Добавлено ${googlePhotos.length} реальных Google Places фото`);
  }
  
  // 2. НЕ добавляем случайные фото - показываем только реальные фото заведения
  // Если Google Places дал меньше фото, это нормально - лучше меньше, но реальных
  
  console.log(`📸 Итого фото для ${locationName}: ${photos.length} (приоритет реальным фото)`);
  return photos; // Возвращаем только релевантные фото
}

function getLocationSpecificPhotos(locationName, category) {
  // Более релевантные фото на основе названия места и категории
  console.log(`📸 Поиск тематических фото для: ${locationName} (${category})`);
  
  // Если есть ключевые слова в названии, используем более специфичные фото
  const name = locationName.toLowerCase();
  
  // Специфичные фото для известных мест
  if (name.includes('sagrada') || name.includes('familia')) {
    return ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80'];
  }
  if (name.includes('park') || name.includes('güell') || name.includes('garden')) {
    return ['https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&h=600&fit=crop&q=80'];
  }
  if (name.includes('beach') || name.includes('sea') || name.includes('ocean')) {
    return ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop&q=80'];
  }
  if (name.includes('museum') || name.includes('art') || name.includes('gallery')) {
    return ['https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&h=600&fit=crop&q=80'];
  }
  
  // Fallback к категориям
  return getThematicPhotos(category, locationName);
}

function getThematicPhotos(category, locationName) {
  const photoCollections = {
    'cafe': [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop&q=80'
    ],
    'restaurant': [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=600&fit=crop&q=80'
    ],
    'tourist_attraction': [
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop&q=80'
    ],
    'museum': [
      'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594736797933-d0d7c1e8b2be?w=800&h=600&fit=crop&q=80'
    ]
  };
  
  return photoCollections[category] || photoCollections['tourist_attraction'];
}

// =============================================================================
// МОДУЛЬ ЦЕНООБРАЗОВАНИЯ: Google Places price_level → реальные цены
// =============================================================================

function calculateRealPrice(category, priceLevel, city) {
  console.log(`💰 МОДУЛЬ ЦЕНЫ: Расчет для ${category}, уровень ${priceLevel}, город ${city}`);
  
  // Базовые цены по категориям (price_level: 0=бесплатно, 1=дешево, 2=средне, 3=дорого, 4=очень дорого)
  const basePrices = {
    'cafe': { 0: 0, 1: 5, 2: 12, 3: 20, 4: 35 },
    'restaurant': { 0: 0, 1: 15, 2: 30, 3: 55, 4: 90 },
    'tourist_attraction': { 0: 0, 1: 8, 2: 18, 3: 35, 4: 60 },
    'museum': { 0: 0, 1: 10, 2: 20, 3: 40, 4: 70 },
    'park': { 0: 0, 1: 0, 2: 5, 3: 15, 4: 25 },
    'bar': { 0: 0, 1: 8, 2: 15, 3: 25, 4: 45 }
  };

  // Коэффициенты по городам (относительно базовых цен)
  const cityMultipliers = {
    'Dubai': 1.8,      // Дорогой город
    'Moscow': 1.2,     // Средне-дорогой
    'Paris': 1.5,      // Дорогой
    'London': 1.6,     // Очень дорогой
    'Barcelona': 1.3,  // Средне-дорогой
    'Berlin': 1.1,     // Умеренный
    'Amsterdam': 1.4,  // Дорогой
    'Copenhagen': 1.7, // Очень дорогой
    'Rome': 1.2,       // Средне-дорогой
    'Prague': 0.8      // Недорогой
  };

  const basePrice = basePrices[category]?.[priceLevel] || basePrices['restaurant'][2];
  const multiplier = cityMultipliers[city] || 1.0;
  const realPrice = Math.round(basePrice * multiplier);
  
  console.log(`💰 Цена рассчитана: ${realPrice}€ (база: ${basePrice}€, множитель: ${multiplier})`);
  return realPrice;
}

function formatPriceRange(category, priceLevel, city) {
  const price = calculateRealPrice(category, priceLevel, city);
  
  if (price === 0) return 'Free';
  if (price <= 10) return `${price}€`;
  
  const rangeMin = Math.max(0, price - 5);
  const rangeMax = price + 5;
  return `${rangeMin}-${rangeMax}€`;
}

// =============================================================================
// МОДУЛЬ 4: ГЕНЕРАЦИЯ МЕТА-ИНФОРМАЦИИ
// =============================================================================

async function generateMetaInfo(city, audience, interests, date, concept) {
  console.log('🏷️ МОДУЛЬ 4: Генерация заголовков и погоды...');
  
  const titlePrompt = `Write a short and inspiring title in English for the day's itinerary.
It must include the city name and reflect the chosen interests.
Always follow the creative concept of the day. Maximum one sentence.

City: ${city}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Example Output:
Paris in Motion: A Day Built for Him

Create the title:`;

  const subtitlePrompt = `Write a long and inspiring subtitle in English for the day's itinerary.
* Mention the date,
* Reflect the city,
* Include the chosen interests and selected locations,
* Describe the rhythm of the day from morning to night,
* Always follow the creative concept of the day. A tone of voice should make the reader want to experience this day immediately.
Length: 3–4 sentences.

City: ${city}
Date: ${date}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Example Output:
On September 10th, Paris is yours to discover — from sunrise runs along the Seine to local markets alive with flavor, from bold art and rooftop skies to the pulse of its legendary nightlife. Every step is planned, every hour alive with energy, and the city carries you through a day made to be unforgettable.

Create the subtitle:`;

  const weatherPrompt = `You are providing weather information for travel planning.

TASK: Look up realistic current weather for ${city} on ${date} (September 2025).

Use your knowledge of ${city}'s climate and typical weather patterns for this time of year.
Consider the city's geographic location, season, and typical temperature ranges.

Provide this information in JSON format:
{
  "temperature": [realistic temperature number for ${city} in September],
  "description": "[weather description without temperature]",
  "clothing": "[brief clothing advice for this specific weather]"
}

Examples:
- Dubai (hot desert): {"temperature": 37, "description": "Clear sunny skies with high humidity", "clothing": "Light breathable fabrics and sun protection"}
- Moscow (continental): {"temperature": 8, "description": "Cool autumn air with possible rain", "clothing": "Warm jacket and layers recommended"}
- Barcelona (Mediterranean): {"temperature": 18, "description": "Pleasant mild weather with sea breeze", "clothing": "Light layers and comfortable shoes"}

IMPORTANT: 
- Use realistic temperature for ${city} specifically
- Consider the actual climate of ${city}
- September 2025 weather patterns

Provide realistic weather for ${city}:`;

  try {
    const [titleResponse, subtitleResponse, weatherResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: titlePrompt }],
        max_tokens: 50,
        temperature: 0.8
      }),
      openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: subtitlePrompt }],
        max_tokens: 150,
        temperature: 0.8
      }),
      openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: weatherPrompt }],
        max_tokens: 150,
        temperature: 0.7
      })
    ]);

    // Парсим погодный ответ от OpenAI
    let weatherData;
    try {
      const weatherContent = weatherResponse.choices[0].message.content.trim();
      weatherData = JSON.parse(weatherContent);
    } catch (parseError) {
      console.log('Weather response not in JSON format, using fallback');
      weatherData = {
        temperature: "22",
        description: "pleasant weather",
        clothing: "Comfortable clothing recommended"
      };
    }

    const result = {
      title: titleResponse.choices[0].message.content.trim().replace(/^["']|["']$/g, ''),
      subtitle: subtitleResponse.choices[0].message.content.trim().replace(/^["']|["']$/g, ''),
      weather: {
        temperature: weatherData.temperature, // Число для отображения вверху
        forecast: weatherData.description,    // Описание без температуры
        clothing: weatherData.clothing,       // Советы по одежде
        tips: 'Perfect weather for exploring!'
      }
    };

    console.log('✅ МОДУЛЬ 4: Мета-информация создана');
    return result;
  } catch (error) {
    console.error('❌ МОДУЛЬ 4: Ошибка мета-информации:', error.message);
    return {
      title: `Epic amazing discoveries in ${city}`,
      subtitle: `${date} for ${audience} - discover the magic of ${city}. Experience authentic moments, create lasting memories, and let the city's unique charm captivate your heart.`,
      weather: {
        temperature: 22, // Fallback температура
        forecast: `Perfect weather for exploring ${city} - ideal conditions for your adventure`,
        clothing: 'Comfortable walking shoes and light layers',
        tips: 'Perfect day for discovering the city!'
      }
    };
  }
}

// =============================================================================
// ГЛАВНАЯ ФУНКЦИЯ API
// =============================================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 SMART ITINERARY: Handler started');
    const { city, audience, interests, date, budget, previewOnly } = req.body;
    console.log('📝 Request data:', { city, audience, interests, date, budget, previewOnly });

    // Проверяем API ключи
    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_MAPS_KEY) {
      console.log('❌ API keys missing');
      throw new Error('API keys required');
    }
    console.log('✅ API keys present');

    // МОДУЛЬ 0: Создаем концепцию дня
    const dayConcept = await generateDayConcept(city, audience, interests, date, budget);
    
    // МОДУЛЬ 1: Находим реальные места
    const locations = await findRealLocations(dayConcept.timeSlots, city);
    
    // МОДУЛЬ 4: Генерируем мета-информацию
    const metaInfo = await generateMetaInfo(city, audience, interests, date, dayConcept.concept);

    // Если previewOnly=true, генерируем только первые 2 локации
    const locationsToProcess = previewOnly ? locations.slice(0, 2) : locations;
    console.log(`📋 Processing ${locationsToProcess.length} locations (previewOnly: ${previewOnly})`);

    // МОДУЛИ 2-3: Генерируем описания и рекомендации для каждого места
    let activities = await Promise.all(locationsToProcess.map(async (slot) => {
      const place = slot.realPlace;
      
      const [description, recommendations] = await Promise.all([
        generateLocationDescription(place.name, place.address, slot.category, interests, audience, dayConcept.concept),
        generateLocationRecommendations(place.name, slot.category, interests, audience, dayConcept.concept)
      ]);

      // Рассчитываем реальную цену на основе Google Places price_level
      const realPrice = calculateRealPrice(slot.category, place.priceLevel, city);
      const priceRange = formatPriceRange(slot.category, place.priceLevel, city);

      return {
        time: slot.time,
        name: place.name,
        title: place.name,
        description: description,
        category: slot.category,
        duration: 90,
        price: realPrice,
        location: place.address,
        photos: generateLocationPhotos(place, slot.category, place.name),
        recommendations: recommendations,
        priceRange: priceRange,
        rating: place.rating
      };
    }));

    // МОДУЛЬ КОНТРОЛЯ БЮДЖЕТА: корректируем цены под бюджет ±30%
    const targetBudget = parseInt(budget);
    const budgetMin = targetBudget * 0.7;
    const budgetMax = targetBudget * 1.3;
    
    let totalCost = activities.reduce((sum, act) => sum + act.price, 0);
    console.log(`💰 БЮДЖЕТ-КОНТРОЛЬ: Начальная сумма ${totalCost}€, целевой бюджет ${targetBudget}€ (${budgetMin}-${budgetMax}€)`);
    
    // Если сумма не в пределах бюджета, корректируем цены пропорционально
    if (totalCost < budgetMin || totalCost > budgetMax) {
      const adjustmentFactor = targetBudget / totalCost;
      console.log(`💰 Корректируем цены с коэффициентом ${adjustmentFactor.toFixed(2)}`);
      
      activities = activities.map(activity => {
        const adjustedPrice = Math.round(activity.price * adjustmentFactor);
        const adjustedRange = formatPriceRange(activity.category, 2, city); // Пересчитываем диапазон
        
        return {
          ...activity,
          price: adjustedPrice,
          priceRange: adjustedRange
        };
      });
      
      totalCost = activities.reduce((sum, act) => sum + act.price, 0);
      console.log(`💰 БЮДЖЕТ-КОНТРОЛЬ: Скорректированная сумма ${totalCost}€`);
    }

    const result = {
      title: metaInfo.title,
      subtitle: metaInfo.subtitle,
      city,
      date,
      budget,
      audience,
      interests,
      conceptual_plan: {
        concept: dayConcept.concept,
        architecture: "clean_modular"
      },
      weather: metaInfo.weather,
      activities,
      totalCost,
      withinBudget: totalCost <= parseInt(budget),
      previewOnly: previewOnly || false,
      totalLocations: locations.length, // Общее количество локаций для полного плана
      // Сохраняем dayConcept и timeSlots для генерации полного плана позже
      dayConcept: previewOnly ? dayConcept : undefined, // Сохраняем только для preview
      timeSlots: previewOnly ? dayConcept.timeSlots : undefined // Сохраняем только для preview
    };

    console.log(`✅ FLIPTRIP CLEAN: План успешно создан (${activities.length} activities, previewOnly: ${previewOnly})`);
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ SMART ITINERARY ERROR:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Full error:', error);
    
    return res.status(500).json({ 
      error: 'Generation failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
// FORCE DEPLOY: Current state with budget control and realistic pricing
