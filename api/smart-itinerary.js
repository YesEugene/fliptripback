// FlipTrip Clean Backend - Smart Itinerary Generator
// Модульная архитектура для генерации плана на день

import OpenAI from 'openai';
import { Client } from '@googlemaps/google-maps-services-js';
import { searchLocationsForItinerary } from '../database/services/locationsService.js';
import { searchToursForItinerary } from '../database/services/toursService.js';
import { getOrCreateCity } from '../database/services/citiesService.js';
import { supabase } from '../database/db.js';
import { ContentBlocksGenerationService } from '../services/ContentBlocksGenerationService.js';
import { ContentBlocksStorageService } from '../services/ContentBlocksStorageService.js';

// Инициализация
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const googleMapsClient = new Client({});

// =============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================================================

/**
 * Get or create user by email
 * @param {string} email - User email
 * @returns {Promise<string|null>} - User ID or null
 */
async function getOrCreateUser(email) {
  if (!email || !email.includes('@')) {
    return null;
  }

  try {
    // Try to find existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return existingUser.id;
    }

    // Create new user if doesn't exist
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: email,
        name: email.split('@')[0], // Use email prefix as name
        role: 'user'
      })
      .select('id')
      .single();

    if (userError) {
      console.error('❌ Error creating user:', userError);
      return null;
    }

    return newUser.id;
  } catch (error) {
    console.error('❌ Error in getOrCreateUser:', error);
    return null;
  }
}

/**
 * Save location from Google Places to database
 * @param {object} placeData - Location data (name, address, category, etc.)
 * @param {string} cityId - City ID
 * @returns {Promise<string|null>} - Location ID or null
 */
async function saveGooglePlaceToDatabase(placeData, cityId) {
  if (!placeData || !placeData.name || !cityId) {
    return null;
  }

  try {
    // Check if location already exists by google_place_id
    if (placeData.googlePlaceId) {
      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .eq('google_place_id', placeData.googlePlaceId)
        .single();

      if (existing) {
        return existing.id;
      }
    }

    // Create new location
    const { data: newLocation, error: locationError } = await supabase
      .from('locations')
      .insert({
        name: placeData.name,
        address: placeData.address || '',
        city_id: cityId,
        category: placeData.category || 'attraction',
        description: placeData.description || null,
        recommendations: placeData.recommendations || null,
        price_level: placeData.priceLevel || 2,
        source: 'google',
        verified: false, // Google Places locations are not verified by default
        google_place_id: placeData.googlePlaceId || null
      })
      .select('id')
      .single();

    if (locationError) {
      console.error('❌ Error saving location:', locationError);
      return null;
    }

    // Save photos if available
    if (placeData.photos && placeData.photos.length > 0 && newLocation.id) {
      const photoInserts = placeData.photos.map(photoUrl => ({
        location_id: newLocation.id,
        url: photoUrl
      }));

      await supabase
        .from('location_photos')
        .insert(photoInserts);
    }

    return newLocation.id;
  } catch (error) {
    console.error('❌ Error in saveGooglePlaceToDatabase:', error);
    return null;
  }
}

/**
 * Save generated tour to database
 * @param {object} tourData - Tour data
 * @param {string} userId - User ID
 * @param {string} cityId - City ID
 * @param {array} activities - Activities array
 * @returns {Promise<string|null>} - Tour ID or null
 */
async function saveGeneratedTourToDatabase(tourData, userId, cityId, activities, interestIds = []) {
  if (!tourData || !cityId) {
    return null;
  }

  try {
    // Create tour record
    const { data: newTour, error: tourError } = await supabase
      .from('tours')
      .insert({
        title: tourData.title || `Tour in ${tourData.city}`,
        description: tourData.subtitle || null,
        city_id: cityId,
        user_id: userId, // Link to user
        guide_id: null, // No guide for AI-generated tours
        source: 'user_generated', // Mark as user-generated
        is_published: false, // Not published on site
        status: 'draft', // Use draft status (valid in constraint)
        default_format: 'self_guided',
        price_pdf: 16.00,
        currency: 'USD',
        duration_type: 'days',
        duration_value: 1
      })
      .select('id')
      .single();

    if (tourError || !newTour) {
      console.error('❌ Error creating tour:', tourError);
      return null;
    }

    const tourId = newTour.id;
    console.log('✅ Tour created in DB:', tourId);

    // Save interests to tour_tags if provided
    if (interestIds && Array.isArray(interestIds) && interestIds.length > 0) {
      try {
        const tourTagInserts = interestIds.map(interestId => ({
          tour_id: tourId,
          tag_id: null, // Must be null for interests
          interest_id: typeof interestId === 'string' && /^\d+$/.test(interestId) ? parseInt(interestId, 10) : interestId
        }));
        
        console.log('💾 Saving interests to tour_tags:', tourTagInserts);
        const { data: insertedTags, error: insertError } = await supabase
          .from('tour_tags')
          .insert(tourTagInserts)
          .select();
        
        if (insertError) {
          console.error('❌ Error inserting interests:', insertError);
        } else {
          console.log(`✅ Linked ${insertedTags.length} interests to tour`);
        }
      } catch (tagError) {
        console.error('❌ Error saving interests (non-critical):', tagError);
        // Don't fail tour creation if interests fail
      }
    }

    // Create tour_day
    const { data: tourDay, error: dayError } = await supabase
      .from('tour_days')
      .insert({
        tour_id: tourId,
        day_number: 1,
        title: `Day 1 in ${tourData.city}`,
        date_hint: tourData.date ? new Date(tourData.date) : null
      })
      .select('id')
      .single();

    if (dayError || !tourDay) {
      console.error('❌ Error creating tour_day:', dayError);
      // Continue anyway - we can still return tourId
      return tourId;
    }

    // CRITICAL: Only create tour_blocks/tour_items if activities are provided
    // If activities array is empty, it means we're using contentBlocks (new format)
    // and should NOT create old format structure
    if (!activities || activities.length === 0) {
      console.log('ℹ️ No activities provided - using contentBlocks format only (no tour_blocks/tour_items)');
      return tourId;
    }

    // Group activities by time blocks
    const timeBlocks = {};
    activities.forEach(activity => {
      const timeKey = activity.time || 'TBD';
      if (!timeBlocks[timeKey]) {
        timeBlocks[timeKey] = [];
      }
      timeBlocks[timeKey].push(activity);
    });

    // Create tour_blocks and tour_items
    let blockIndex = 0;
    for (const [time, blockActivities] of Object.entries(timeBlocks)) {
      const [startTime, endTime] = time.includes(' - ') 
        ? time.split(' - ') 
        : [time, null];

      const { data: tourBlock, error: blockError } = await supabase
        .from('tour_blocks')
        .insert({
          tour_day_id: tourDay.id,
          start_time: startTime || null,
          end_time: endTime || null,
          title: time
        })
        .select('id')
        .single();

      if (blockError || !tourBlock) {
        console.error('❌ Error creating tour_block:', blockError);
        continue;
      }

      // Create tour_items for each activity
      for (let i = 0; i < blockActivities.length; i++) {
        const activity = blockActivities[i];
        let locationId = null;

        // CRITICAL: Only use location_id if location is from database (created by guide)
        // Do NOT save Google Places locations to database to avoid cluttering locations table
        // All location data will be stored in tour_items.custom_* fields
        if (activity.locationId) {
          // Location is from database (created by guide) - use its ID
          locationId = activity.locationId;
          console.log(`✅ Using existing location from DB: ${locationId}`);
        } else if (activity.fromGooglePlace) {
          // Location is from Google Places - do NOT save to database
          // Store all data in tour_items.custom_* fields instead
          locationId = null; // Explicitly set to null
          console.log(`ℹ️ Google Places location - storing in tour_items only (not saving to locations table)`);
        }

        await supabase
          .from('tour_items')
          .insert({
            tour_block_id: tourBlock.id,
            location_id: locationId, // null for Google Places locations
            custom_title: activity.name || activity.title,
            custom_description: activity.description || null,
            custom_recommendations: activity.recommendations || null,
            order_index: i,
            duration_minutes: activity.duration || 90,
            approx_cost: activity.price || null
          });
      }

      blockIndex++;
    }

    console.log(`✅ Tour structure saved: ${blockIndex} blocks, ${activities.length} items`);
    return tourId;
  } catch (error) {
    console.error('❌ Error in saveGeneratedTourToDatabase:', error);
    return null;
  }
}

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
        try {
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
              photos: place.photos ? place.photos.slice(0, 10).map(photo => 
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
              ) : [],
              fromDatabase: false,
              googlePlaceId: place.place_id || null, // Save Google Place ID for later
              category: slot.category || 'attraction'
            };
            console.log(`✅ Found in Google Places: ${place.name}`);
          }
        } catch (googleError) {
          // Google Places API error (e.g., 403 - not paid, quota exceeded, etc.)
          // Log but don't fail - use fallback location instead
          console.warn(`⚠️ Google Places search error for "${slot.activity}": ${googleError.message || googleError}`);
          // Continue with fallback location
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
    
    const { city, audience, interests, interest_ids, date, date_from, date_to, budget, previewOnly, category_id, subcategory_id, email } = req.body;
    
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

    // NEW: Генерируем контентные блоки (17 блоков в правильной последовательности)
    const blocksService = new ContentBlocksGenerationService();
    const contentBlocks = await blocksService.generateFullDayBlocks({
      city,
      audience,
      interests: interestsForConcept || [],
      concept: dayConcept.concept,
      locations,
      dayConcept
    });
    console.log(`✅ Generated ${contentBlocks.length} content blocks`);

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
        rating: place.rating,
        // Metadata for saving to DB
        locationId: place.locationId || null, // If from DB
        fromGooglePlace: !place.fromDatabase, // If from Google Places
        googlePlaceId: place.googlePlaceId || null,
        priceLevel: place.priceLevel || 2
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
        architecture: "content_blocks", // New architecture with content blocks
        timeSlots: dayConcept.timeSlots // Сохраняем полный список слотов для последующей генерации
      },
      weather: metaInfo.weather,
      contentBlocks: contentBlocks, // NEW: Content blocks instead of just activities
      activities, // Keep for backward compatibility and budget calculation
      totalCost,
      withinBudget: totalCost <= parseInt(budget),
      previewOnly: previewOnly || false // Сохраняем флаг preview режима
    };

    // If preview mode, save tour to database
    if (previewOnly) {
      try {
        console.log('💾 PREVIEW MODE: Saving tour to database...');
        
        // Get or create user by email (if provided)
        const email = req.body.email || null;
        let userId = null;
        if (email) {
          userId = await getOrCreateUser(email);
          console.log('👤 User ID:', userId);
        }

        // Get city ID
        let cityIdForTour = cityId;
        if (!cityIdForTour) {
          cityIdForTour = await getOrCreateCity(city, null);
        }

        if (cityIdForTour) {
          // Save tour to database
          // For tours with contentBlocks, we still call saveGeneratedTourToDatabase but it won't create tour_blocks/tour_items
          // because we pass empty activities array when contentBlocks exist
          const tourId = await saveGeneratedTourToDatabase(
            {
              title: metaInfo.title,
              subtitle: metaInfo.subtitle,
              city: city,
              date: date
            },
            userId,
            cityIdForTour,
            [], // Pass empty activities array - we use contentBlocks instead
            interestIds // Pass interestIds to save to tour_tags
          );

          if (tourId) {
            result.tourId = tourId;
            console.log('✅ Tour saved to database with ID:', tourId);
            
            // NEW: Save content blocks to tour_content_blocks
            try {
              console.log('💾 Saving content blocks to database...');
              const blocksStorage = new ContentBlocksStorageService();
              const saveResult = await blocksStorage.saveContentBlocks(
                tourId,
                contentBlocks,
                locations
              );
              
              if (saveResult.success) {
                console.log(`✅ Saved ${saveResult.saved} content blocks to database`);
              } else {
                console.warn(`⚠️ Some blocks failed to save: ${saveResult.errors} errors`);
              }
            } catch (blocksError) {
              console.error('❌ Error saving content blocks:', blocksError);
              // Don't fail the whole operation if blocks save fails
            }
            
            console.log('📋 Returning tourId in response:', tourId);
          } else {
            console.warn('⚠️ Failed to save tour to database, but continuing...');
            console.warn('⚠️ Response will NOT include tourId');
          }
        } else {
          console.warn('⚠️ City ID not found, skipping tour save');
        }
      } catch (saveError) {
        console.error('❌ Error saving tour to database:', saveError);
        // Don't fail the request - continue without tourId
      }
    }

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
