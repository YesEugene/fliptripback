// FlipTrip Clean Backend - Complete Itinerary API
// Генерирует полный план на основе сохраненного частичного плана
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { Client } from '@googlemaps/google-maps-services-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITINERARIES_FILE = path.join(__dirname, '../data/itineraries.json');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const googleMapsClient = new Client({});

// Load itineraries from file
async function loadItineraries() {
  try {
    const data = await fs.readFile(ITINERARIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Save itineraries to file
async function saveItineraries(itineraries) {
  const dataDir = path.dirname(ITINERARIES_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  await fs.writeFile(ITINERARIES_FILE, JSON.stringify(itineraries, null, 2), 'utf-8');
}

// Import functions from smart-itinerary.js
// We'll need to duplicate the logic or import it
async function generateLocationDescription(locationName, address, category, interests, audience, concept) {
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

Create the description:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.8
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    return `Experience the authentic charm of ${locationName}, a beloved ${category} that captures the essence of the city.`;
  }
}

async function generateLocationRecommendations(locationName, category, interests, audience, concept) {
  const prompt = `IMPORTANT: Write EXACTLY 1 complete sentence in English with practical tips for visiting this location.
Include specific advice about timing, what to order/see/do, or insider secrets that enhance the experience.
Make the tip personal, caring, and inspiring — like advice from a knowledgeable local friend.
REQUIREMENT: Your response must be exactly 1 complete sentence with a period.

Location: ${locationName}
Category: ${category}
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests}
Audience: ${audience}
Creative concept: ${concept}

Create the tips:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.8
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    return `Plan to spend quality time at ${locationName} to fully appreciate its unique character.`;
  }
}

function generateLocationPhotos(place, category, locationName) {
  const photos = [];
  if (place.photos && place.photos.length > 0) {
    const googlePhotos = place.photos.map(photo => 
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
    );
    photos.push(...googlePhotos);
  }
  return photos;
}

function calculateRealPrice(category, priceLevel, city) {
  const basePrices = {
    'cafe': { 0: 0, 1: 5, 2: 12, 3: 20, 4: 35 },
    'restaurant': { 0: 0, 1: 15, 2: 30, 3: 55, 4: 90 },
    'tourist_attraction': { 0: 0, 1: 8, 2: 18, 3: 35, 4: 60 },
    'museum': { 0: 0, 1: 10, 2: 20, 3: 40, 4: 70 },
    'park': { 0: 0, 1: 0, 2: 5, 3: 15, 4: 25 },
    'bar': { 0: 0, 1: 8, 2: 15, 3: 25, 4: 45 }
  };

  const cityMultipliers = {
    'Dubai': 1.8, 'Moscow': 1.2, 'Paris': 1.5, 'London': 1.6,
    'Barcelona': 1.3, 'Berlin': 1.1, 'Amsterdam': 1.4, 'Copenhagen': 1.7,
    'Rome': 1.2, 'Prague': 0.8
  };

  const basePrice = basePrices[category]?.[priceLevel] || basePrices['restaurant'][2];
  const multiplier = cityMultipliers[city] || 1.0;
  return Math.round(basePrice * multiplier);
}

function formatPriceRange(category, priceLevel, city) {
  const price = calculateRealPrice(category, priceLevel, city);
  if (price === 0) return 'Free';
  if (price <= 10) return `${price}€`;
  const rangeMin = Math.max(0, price - 5);
  const rangeMax = price + 5;
  return `${rangeMin}-${rangeMax}€`;
}

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
    console.log('🚀 COMPLETE ITINERARY: Generating full plan...');
    const { itineraryId } = req.body;

    if (!itineraryId) {
      return res.status(400).json({ error: 'Itinerary ID is required' });
    }

    // Load saved partial itinerary
    const itineraries = await loadItineraries();
    const partialItinerary = itineraries[itineraryId];

    if (!partialItinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    if (!partialItinerary.previewOnly) {
      // Already complete
      return res.status(200).json({ 
        success: true, 
        itinerary: partialItinerary 
      });
    }

    console.log(`📋 Generating full plan for ${partialItinerary.city}...`);

    const { city, audience, interests, date, budget, dayConcept, timeSlots, activities: existingActivities } = partialItinerary;

    if (!dayConcept || !timeSlots) {
      return res.status(400).json({ 
        error: 'Cannot complete itinerary: missing day concept or time slots. Please regenerate.' 
      });
    }

    console.log(`📋 Generating remaining locations (${existingActivities.length} already generated, ${timeSlots.length} total)...`);

    // Find remaining time slots (skip first 2 that were already generated)
    const remainingTimeSlots = timeSlots.slice(2);
    
    // Find remaining locations
    const remainingLocations = await Promise.all(remainingTimeSlots.map(async (slot) => {
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
          
          let detailedPlace = place;
          if (place.place_id) {
            try {
              const detailsResponse = await googleMapsClient.placeDetails({
                params: {
                  place_id: place.place_id,
                  fields: ['photos', 'rating', 'price_level', 'formatted_address', 'name'],
                  key: process.env.GOOGLE_MAPS_KEY
                }
              });
              detailedPlace = detailsResponse.data.result;
            } catch (detailError) {
              console.log(`⚠️ Не удалось получить детали для ${place.name}`);
            }
          }
          
          return {
            ...slot,
            realPlace: {
              name: detailedPlace.name || place.name,
              address: detailedPlace.formatted_address || place.formatted_address,
              rating: detailedPlace.rating || place.rating || 4.0,
              priceLevel: detailedPlace.price_level || place.price_level || 2,
              photos: detailedPlace.photos || []
            }
          };
        } else {
          return {
            ...slot,
            realPlace: {
              name: slot.activity,
              address: `${city} City Center`,
              rating: 4.0,
              priceLevel: 2,
              photos: []
            }
          };
        }
      } catch (error) {
        console.error(`❌ Ошибка поиска для ${slot.activity}:`, error.message);
        return {
          ...slot,
          realPlace: {
            name: slot.activity,
            address: `${city} City Center`,
            rating: 4.0,
            priceLevel: 2,
            photos: []
          }
        };
      }
    }));

    // Generate descriptions and recommendations for remaining locations
    const remainingActivities = await Promise.all(remainingLocations.map(async (slot) => {
      const place = slot.realPlace;
      
      const [description, recommendations] = await Promise.all([
        generateLocationDescription(place.name, place.address, slot.category, interests, audience, dayConcept.concept),
        generateLocationRecommendations(place.name, slot.category, interests, audience, dayConcept.concept)
      ]);

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

    // Combine existing and new activities
    const allActivities = [...existingActivities, ...remainingActivities];

    // Recalculate total cost
    const totalCost = allActivities.reduce((sum, act) => sum + act.price, 0);

    // Create complete itinerary
    const completeItinerary = {
      ...partialItinerary,
      activities: allActivities,
      totalCost,
      previewOnly: false,
      updatedAt: new Date().toISOString()
    };

    // Save complete itinerary
    itineraries[itineraryId] = completeItinerary;
    await saveItineraries(itineraries);

    console.log(`✅ COMPLETE ITINERARY: Full plan generated with ${allActivities.length} activities`);
    return res.status(200).json({ 
      success: true, 
      itinerary: completeItinerary 
    });

  } catch (error) {
    console.error('❌ COMPLETE ITINERARY ERROR:', error.message);
    return res.status(500).json({ 
      error: 'Failed to complete itinerary', 
      message: error.message
    });
  }
}

