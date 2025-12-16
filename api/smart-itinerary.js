// FlipTrip Clean Backend - Smart Itinerary Generator
// Модульная архитектура для генерации плана на день

import OpenAI from 'openai';
import { Client } from '@googlemaps/google-maps-services-js';
import { searchLocationsForItinerary } from '../database/services/locationsService.js';
import { searchToursForItinerary } from '../database/services/toursService.js';
import { getOrCreateCity } from '../database/services/citiesService.js';
import { supabase } from '../database/db.js';

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
  
  const prompt = `Create a full-day itinerary (9 AM - 9:30 PM) for ${city} on ${date}.

Context: ${audience}, interests: ${Array.isArray(interests) ? interests.join(', ') : interests}, budget: ${budget}€

Return JSON only:
{
  "concept": "Brief theme",
  "timeSlots": [
    {
      "time": "09:00",
      "activity": "Morning coffee",
      "category": "cafe",
      "description": "Short description",
      "keywords": ["coffee", "morning"],
      "budgetTier": "budget"
    }
  ]
}

Balance activities/meals. Budget ±30%.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.7
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

async function findRealLocations(timeSlots, city, interestIds = []) {
  console.log('📍 МОДУЛЬ 1: Поиск реальных мест...');
  console.log('🔍 findRealLocations called with interestIds:', interestIds, 'type:', typeof interestIds, 'length:', interestIds?.length || 0);
  
  // Get city_id from city name
  let cityId = null;
  try {
    cityId = await getOrCreateCity(city, null);
    console.log(`🏙️ City ID for ${city}: ${cityId}`);
  } catch (error) {
    console.error('Error getting city ID:', error);
  }
  
  const locations = [];
  
  for (const slot of timeSlots) {
    try {
      let foundLocation = null;
      
      // STEP 1: Search in database first
      if (cityId) {
        try {
          const categories = slot.category ? [slot.category] : [];
          const tags = slot.keywords || [];
          
          console.log(`🔍 Searching DB for: cityId=${cityId}, category=${slot.category}, categories=[${categories.join(',')}], tags=[${tags.join(',')}], interestIds=[${interestIds.map(id => String(id)).join(',')}] (${interestIds.length} total)`);
          
          // CRITICAL: Only search with interestIds if they are provided and not empty
          let dbResult = await searchLocationsForItinerary(cityId, categories, tags, interestIds.length > 0 ? interestIds : [], 10);
          
          // If no results with category filter, try without category but KEEP interest filter
          if (!dbResult.success || !dbResult.locations || dbResult.locations.length === 0) {
            console.log(`⚠️ No locations found with category filter, trying without category but keeping interest filter...`);
            if (interestIds.length > 0) {
              dbResult = await searchLocationsForItinerary(cityId, [], tags, interestIds, 10);
            }
          }
          
          // LAST RESORT: Only if still no results AND we have interestIds, try without interest filter
          if ((!dbResult.success || !dbResult.locations || dbResult.locations.length === 0) && interestIds.length > 0) {
            console.log(`⚠️⚠️⚠️ WARNING: No locations found in DB matching interests. Trying without interest filter...`);
            dbResult = await searchLocationsForItinerary(cityId, categories, tags, [], 10);
          }
          
          console.log(`📊 DB search result: ${dbResult.locations?.length || 0} locations found`);
          
          if (dbResult.success && dbResult.locations && dbResult.locations.length > 0) {
            // Use first matching location from DB
            const dbLocation = dbResult.locations[0];
            foundLocation = {
              name: dbLocation.name,
              address: dbLocation.address,
              rating: 4.5, // Default rating for verified locations
              priceLevel: dbLocation.price_level || 2,
              photos: dbLocation.photos?.map(p => p.url) || [],
              fromDatabase: true,
              locationId: dbLocation.id,
              description: dbLocation.description,
              recommendations: dbLocation.recommendations,
              category: dbLocation.category
            };
            console.log(`✅ Found in DB: ${dbLocation.name}`);
          }
        } catch (dbError) {
          console.error('❌ DB search error:', dbError);
        }
      }
      
      // STEP 2: If not found in DB, use Google Places as fallback
      if (!foundLocation) {
        const searchQuery = `${slot.keywords.join(' ')} ${slot.category} in ${city}`;
        console.log(`🔍 Searching Google Places: ${searchQuery}`);
        
        const response = await googleMapsClient.textSearch({
          params: {
            query: searchQuery,
            key: process.env.GOOGLE_MAPS_KEY,
            language: 'en'
          }
        });

        if (response.data.results.length > 0) {
          const place = response.data.results[0];
          foundLocation = {
            name: place.name,
            address: place.formatted_address,
            rating: place.rating || 4.0,
            priceLevel: place.price_level || 2,
            photos: place.photos ? place.photos.slice(0, 3).map(photo => 
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
            ) : [],
            fromDatabase: false
          };
          console.log(`✅ Found in Google Places: ${place.name}`);
        }
      }
      
      // STEP 3: If still not found, use fallback
      if (!foundLocation) {
        console.log(`⚠️ Место не найдено для: ${slot.activity}`);
        foundLocation = {
          name: slot.activity,
          address: `${city} City Center`,
          rating: 4.0,
          priceLevel: 2,
          photos: [],
          fromDatabase: false
        };
      }
      
      locations.push({
        ...slot,
        realPlace: foundLocation
      });
    } catch (error) {
      console.error(`❌ Ошибка поиска для ${slot.activity}:`, error.message);
      locations.push({
        ...slot,
        realPlace: {
          name: slot.activity,
          address: `${city} City Center`,
          rating: 4.0,
          priceLevel: 2,
          photos: [],
          fromDatabase: false
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
  
  const prompt = `Write 3-4 sentences about ${locationName} (${category}) in ${address}. Include atmosphere, what makes it special, sensory details. Connect to interests: ${Array.isArray(interests) ? interests.join(', ') : interests}. Make it vivid and engaging.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const description = response.choices[0].message.content.trim();
    console.log(`✅ МОДУЛЬ 2: Описание создано для ${locationName}`);
    return description;
  } catch (error) {
    console.error(`❌ МОДУЛЬ 2: Ошибка описания для ${locationName}:`, error.message);
    return `${locationName} is a ${category} that captures the essence of the city. This location offers a perfect blend of local culture and unique atmosphere. The vibrant energy makes it an unforgettable stop on your journey.`;
  }
}

// =============================================================================
// МОДУЛЬ 3: ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ
// =============================================================================

async function generateLocationRecommendations(locationName, category, interests, audience, concept) {
  console.log(`💡 МОДУЛЬ 3: Генерация рекомендаций для ${locationName}...`);
  
  const prompt = `Write 1 practical tip sentence for visiting ${locationName} (${category}). Include timing/ordering/insider advice. Connect to interests: ${Array.isArray(interests) ? interests.join(', ') : interests}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0.7
    });

    const tips = response.choices[0].message.content.trim();
    console.log(`✅ МОДУЛЬ 3: Рекомендации созданы для ${locationName}`);
    return tips;
  } catch (error) {
    console.error(`❌ МОДУЛЬ 3: Ошибка рекомендаций для ${locationName}:`, error.message);
    return `Visit ${locationName} to fully appreciate its unique character and authentic atmosphere.`;
  }
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
  
  // Объединяем все в один запрос для экономии
  const combinedPrompt = `Generate itinerary metadata for ${city} on ${date}.

1. Title (3-7 words): Creative title reflecting interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
2. Subtitle (3-4 sentences): Describe day flow, mention date, city, interests, audience: ${audience}
3. Weather JSON: {"temperature": number, "description": "weather", "clothing": "advice"}

Return JSON:
{
  "title": "Title here",
  "subtitle": "Subtitle here",
  "weather": {"temperature": 20, "description": "...", "clothing": "..."}
}`;

  try {
    const [combinedResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: combinedPrompt }],
        max_tokens: 250,
        temperature: 0.7
      })
    ]);
    
    // Парсим объединенный ответ
    let metaData;
    try {
      const content = combinedResponse.choices[0].message.content.trim();
      metaData = JSON.parse(content);
    } catch (parseError) {
      // Если не JSON, пытаемся извлечь данные
      const content = combinedResponse.choices[0].message.content.trim();
      const titleMatch = content.match(/title["\s:]+"([^"]+)"/i) || content.match(/1\.\s*Title[:\s]+(.+)/i);
      const subtitleMatch = content.match(/subtitle["\s:]+"([^"]+)"/i) || content.match(/2\.\s*Subtitle[:\s]+(.+)/i);
      const weatherMatch = content.match(/weather["\s:]+({[^}]+})/i);
      
      metaData = {
        title: titleMatch ? titleMatch[1].trim() : `${city} Discovery`,
        subtitle: subtitleMatch ? subtitleMatch[1].trim() : `${date} - discover ${city}. Experience authentic moments and create lasting memories.`,
        weather: weatherMatch ? JSON.parse(weatherMatch[1]) : { temperature: 20, description: "Pleasant weather", clothing: "Comfortable clothing" }
      };
    }

    const result = {
      title: (metaData.title || `${city} Discovery`).replace(/^["']|["']$/g, ''),
      subtitle: metaData.subtitle || `${date} - discover ${city}. Experience authentic moments and create lasting memories.`,
      weather: {
        temperature: metaData.weather?.temperature || 20,
        forecast: metaData.weather?.description || "Pleasant weather",
        clothing: metaData.weather?.clothing || "Comfortable clothing",
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
    // Handle special action: generateTags (for tag suggestions, no OpenAI/Google Places calls)
    if (req.body.action === 'generateTags') {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required for tag generation' });
      }
      
      // Simple keyword extraction (no OpenAI call to save costs)
      const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'];
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.includes(word));
      
      const uniqueTags = [...new Set(words)].slice(0, 15);
      
      return res.status(200).json({ 
        success: true,
        tags: uniqueTags 
      });
    }
    
    const { city, audience, interests, interest_ids, date, date_from, date_to, budget, previewOnly, category_id, subcategory_id } = req.body;
    
    // Support both interests (legacy) and interest_ids (new system)
    let interestIds = [];
    if (interest_ids) {
      if (Array.isArray(interest_ids)) {
        interestIds = interest_ids;
      } else if (typeof interest_ids === 'string') {
        interestIds = interest_ids.split(',').map(id => id.trim()).filter(id => id);
      } else {
        interestIds = [interest_ids];
      }
    }
    const interestsList = interests || [];
    
    // Use date_from if provided, otherwise fall back to date (legacy support)
    const itineraryDate = date_from || date || new Date().toISOString().slice(0, 10);
    
    console.log('🚀 FLIPTRIP CLEAN: Генерация плана для:', { city, audience, interests, interest_ids: interestIds, date: itineraryDate, date_from, date_to, budget, previewOnly });

    // Проверяем API ключи
    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_MAPS_KEY) {
      throw new Error('API keys required');
    }

    // Get interest names by IDs if interestIds provided
    let interestsForConcept = interestsList;
    if (interestIds.length > 0 && interestsList.length === 0) {
      try {
        const { data: interestsData, error: interestsError } = await supabase
          .from('interests')
          .select('id, name')
          .in('id', interestIds.map(id => String(id)));
        
        if (!interestsError && interestsData && interestsData.length > 0) {
          interestsForConcept = interestsData.map(i => i.name);
          console.log('📋 Получены названия интересов по ID:', interestsForConcept);
        } else {
          console.error('❌ Ошибка получения интересов:', interestsError);
        }
      } catch (err) {
        console.error('❌ Ошибка при получении интересов из БД:', err);
      }
    }

    // =============================================================================
    // ПРИОРИТЕТ 1: ПОИСК ТУРОВ В БД (согласно плану)
    // =============================================================================
    console.log('🔍 ПРИОРИТЕТ 1: Поиск туров в БД...');
    
    let cityId = null;
    try {
      cityId = await getOrCreateCity(city, null);
    } catch (error) {
      console.error('Error getting city ID:', error);
    }
    
    let foundTour = null;
    if (cityId) {
      try {
        // Extract tags from interests or use empty array
        const tags = interestsForConcept || [];
        
        // Determine format (default to self_guided)
        const format = 'self_guided'; // Can be extended later
        
        // Search for tours matching criteria
        const toursResult = await searchToursForItinerary(
          cityId,
          [], // categories (can be extended)
          tags,
          interestIds.map(id => String(id)),
          format,
          budget ? parseInt(budget) : null,
          1 // Limit to 1 best match
        );
        
        if (toursResult.success && toursResult.tours && toursResult.tours.length > 0) {
          foundTour = toursResult.tours[0];
          console.log(`✅ Найден подходящий тур: "${foundTour.title}" (ID: ${foundTour.id})`);
        } else {
          console.log('ℹ️ Подходящих туров в БД не найдено, генерируем новый маршрут');
        }
      } catch (tourSearchError) {
        console.error('❌ Ошибка поиска туров:', tourSearchError);
        // Continue with generation if tour search fails
      }
    }
    
    // If tour found, convert it to itinerary format and return
    if (foundTour) {
      console.log('📋 Используем найденный тур из БД');
      
      // Convert tour structure to itinerary format
      const activities = [];
      
      // Iterate through tour_days → tour_blocks → tour_items
      if (foundTour.tour_days && Array.isArray(foundTour.tour_days)) {
        foundTour.tour_days.forEach(day => {
          if (day.tour_blocks && Array.isArray(day.tour_blocks)) {
            day.tour_blocks.forEach(block => {
              if (block.tour_items && Array.isArray(block.tour_items)) {
                block.tour_items.forEach(item => {
                  const location = item.location;
                  if (location) {
                    activities.push({
                      time: block.start_time ? `${block.start_time} - ${block.end_time || block.start_time}` : 'TBD',
                      title: item.custom_title || location.name,
                      address: location.address || '',
                      description: item.custom_description || location.description || '',
                      recommendations: item.custom_recommendations || location.recommendations || '',
                      category: location.category || 'attraction',
                      photos: location.photos?.map(p => p.url) || [],
                      price: item.approx_cost || 0,
                      priceRange: item.approx_cost ? `€${item.approx_cost}` : 'Free',
                      rating: 4.5, // Default for verified locations
                      fromDatabase: true,
                      locationId: location.id
                    });
                  }
                });
              }
            });
          }
        });
      }
      
      // Generate meta info for the tour
      const metaInfo = await generateMetaInfo(city, audience, interestsForConcept, itineraryDate);
      
      const result = {
        title: foundTour.title || metaInfo.title,
        subtitle: foundTour.description || metaInfo.subtitle,
        city,
        date: itineraryDate,
        budget,
        conceptual_plan: {
          concept: foundTour.description || `Curated tour: ${foundTour.title}`,
          architecture: "database_tour",
          source: "database"
        },
        weather: metaInfo.weather,
        activities,
        totalCost: activities.reduce((sum, act) => sum + act.price, 0),
        withinBudget: true,
        previewOnly: previewOnly || false,
        tourId: foundTour.id, // Include tour ID for reference
        fromDatabase: true
      };
      
      console.log('✅ FLIPTRIP CLEAN: Использован тур из БД');
      return res.status(200).json(result);
    }
    
    // =============================================================================
    // ПРИОРИТЕТ 2: ГЕНЕРАЦИЯ НОВОГО МАРШРУТА (если тур не найден)
    // =============================================================================
    console.log('🎨 ПРИОРИТЕТ 2: Генерация нового маршрута...');

    // МОДУЛЬ 0: Создаем концепцию дня (use interest names, not IDs)
    const dayConcept = await generateDayConcept(city, audience, interestsForConcept, itineraryDate, budget);
    
    // МОДУЛЬ 1: Находим реальные места (pass interestIds for DB filtering)
    console.log(`🔍 Поиск локаций с interestIds: [${interestIds.join(', ')}]`);
    const locations = await findRealLocations(dayConcept.timeSlots, city, interestIds);
    
    // МОДУЛЬ 4: Генерируем мета-информацию
    const metaInfo = await generateMetaInfo(city, audience, interests, date, dayConcept.concept);

    // МОДУЛИ 2-3: Генерируем описания и рекомендации для каждого места
    let activities = await Promise.all(locations.map(async (slot) => {
      const place = slot.realPlace;
      
      const [description, recommendations] = await Promise.all([
        generateLocationDescription(place.name, place.address, slot.category, interestsForConcept, audience, dayConcept.concept),
        generateLocationRecommendations(place.name, slot.category, interestsForConcept, audience, dayConcept.concept)
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
        photos: place.photos.length > 0 ? place.photos : [
          'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80'
        ],
        recommendations: recommendations,
        priceRange: priceRange,
        rating: place.rating
      };
    }));

    // CRITICAL: For preview, we save ALL activities but flag as previewOnly
    // Frontend will show only 2 blocks, but full plan is saved for after payment
    // DO NOT slice here - save full plan with previewOnly flag
    if (previewOnly) {
      console.log('👁️ PREVIEW MODE: Saving FULL plan with previewOnly=true flag');
    }

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
      conceptual_plan: {
        concept: dayConcept.concept,
        architecture: "clean_modular",
        timeSlots: dayConcept.timeSlots // Сохраняем полный список слотов для последующей генерации
      },
      weather: metaInfo.weather,
      activities,
      totalCost,
      withinBudget: totalCost <= parseInt(budget),
      previewOnly: previewOnly || false // Сохраняем флаг preview режима
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
