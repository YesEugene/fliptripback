// FlipTrip Clean Backend - Smart Itinerary Generator
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
• Consider the audience (for him, for her, for a couple, for a child) and adapt the tone of the day accordingly.
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
        locations.push({
          ...slot,
          realPlace: {
            name: place.name,
            address: place.formatted_address,
            rating: place.rating || 4.0,
            priceLevel: place.price_level || 2,
            photos: place.photos ? place.photos.slice(0, 3).map(photo => 
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
            ) : []
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

  const weatherPrompt = `Write 2 short sentences in English about the weather in the chosen city and date.
Give a specific suggestion on what to wear to stay comfortable all day.
Keep the tone light, friendly, and aligned with the overall concept of the day.

City: ${city}
Date: ${date}
Creative concept: ${concept}

Example Output:
The September sun will be warm but gentle over Paris, with a cool breeze by the river. Light layers and comfortable shoes will keep you ready for every moment.

Create the weather description:`;

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
        max_tokens: 100,
        temperature: 0.7
      })
    ]);

    const result = {
      title: titleResponse.choices[0].message.content.trim().replace(/^["']|["']$/g, ''),
      subtitle: subtitleResponse.choices[0].message.content.trim().replace(/^["']|["']$/g, ''),
      weather: {
        forecast: weatherResponse.choices[0].message.content.trim(),
        clothing: 'Comfortable walking shoes and light layers',
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
        forecast: `Perfect weather for exploring ${city} - 26°C with clear skies`,
        clothing: 'Comfortable walking shoes and light layers',
        tips: 'Stay hydrated and bring a camera!'
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
    const { city, audience, interests, date, budget } = req.body;
    console.log('🚀 FLIPTRIP CLEAN: Генерация плана для:', { city, audience, interests, date, budget });

    // Проверяем API ключи
    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_MAPS_KEY) {
      throw new Error('API keys required');
    }

    // МОДУЛЬ 0: Создаем концепцию дня
    const dayConcept = await generateDayConcept(city, audience, interests, date, budget);
    
    // МОДУЛЬ 1: Находим реальные места
    const locations = await findRealLocations(dayConcept.timeSlots, city);
    
    // МОДУЛЬ 4: Генерируем мета-информацию
    const metaInfo = await generateMetaInfo(city, audience, interests, date, dayConcept.concept);

    // МОДУЛИ 2-3: Генерируем описания и рекомендации для каждого места
    const activities = await Promise.all(locations.map(async (slot) => {
      const place = slot.realPlace;
      
      const [description, recommendations] = await Promise.all([
        generateLocationDescription(place.name, place.address, slot.category, interests, audience, dayConcept.concept),
        generateLocationRecommendations(place.name, slot.category, interests, audience, dayConcept.concept)
      ]);

      return {
        time: slot.time,
        name: place.name,
        title: place.name,
        description: description,
        category: slot.category,
        duration: 90,
        price: 25,
        location: place.address,
        photos: place.photos.length > 0 ? place.photos : [
          'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80'
        ],
        recommendations: recommendations,
        priceRange: '20-30€',
        rating: place.rating
      };
    }));

    const totalCost = activities.reduce((sum, act) => sum + act.price, 0);

    const result = {
      title: metaInfo.title,
      subtitle: metaInfo.subtitle,
      city,
      date,
      budget,
      conceptual_plan: {
        concept: dayConcept.concept,
        architecture: "clean_modular"
      },
      weather: metaInfo.weather,
      activities,
      totalCost,
      withinBudget: totalCost <= parseInt(budget)
    };

    console.log('✅ FLIPTRIP CLEAN: План успешно создан');
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ FLIPTRIP CLEAN: Ошибка:', error);
    return res.status(500).json({ 
      error: 'Generation failed', 
      message: error.message 
    });
  }
}
