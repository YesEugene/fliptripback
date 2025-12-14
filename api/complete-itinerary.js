// FlipTrip Clean Backend - Complete Itinerary Generation
// Генерирует полный план на основе сохраненного preview (2 локации)

import { Redis } from '@upstash/redis';
import OpenAI from 'openai';
import { Client } from '@googlemaps/google-maps-services-js';
import { 
  findRealLocations, 
  generateLocationDescription, 
  generateLocationRecommendations, 
  calculateRealPrice, 
  formatPriceRange 
} from './smart-itinerary.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const googleMapsClient = new Client({});

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set. Please check FTSTORAGE_KV_REST_API_URL and FTSTORAGE_KV_REST_API_TOKEN.');
  }
  
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  // CORS headers must be set at the very beginning
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    const { itineraryId, formData } = req.body;

    if (!itineraryId) {
      return res.status(400).json({ success: false, error: 'Itinerary ID is required' });
    }

    if (!formData) {
      return res.status(400).json({ success: false, error: 'Form data is required' });
    }

    console.log(`🔄 COMPLETE ITINERARY: Loading preview plan for ID: ${itineraryId}`);
    const savedItineraryData = await redis.get(`itinerary:${itineraryId}`);

    if (!savedItineraryData) {
      return res.status(404).json({ success: false, error: 'Preview itinerary not found' });
    }

    // Redis might return already parsed object or string
    const savedItinerary = typeof savedItineraryData === 'string' 
      ? JSON.parse(savedItineraryData) 
      : savedItineraryData;
    
    console.log('✅ Loaded saved itinerary:', {
      hasConceptualPlan: !!savedItinerary.conceptual_plan,
      hasTimeSlots: !!savedItinerary.conceptual_plan?.timeSlots,
      activitiesCount: savedItinerary.activities?.length,
      previewOnly: savedItinerary.previewOnly
    });
    const { city, audience, interests, date, budget } = formData;

    // Ensure API keys are present
    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_MAPS_KEY) {
      throw new Error('API keys required');
    }

    // Use the conceptual plan from the saved preview
    if (!savedItinerary.conceptual_plan || !savedItinerary.conceptual_plan.timeSlots) {
      return res.status(400).json({ success: false, error: 'Preview itinerary missing conceptual plan timeSlots' });
    }

    const conceptualTimeSlots = savedItinerary.conceptual_plan.timeSlots;
    console.log('✅ Using conceptual time slots from saved preview:', conceptualTimeSlots.length, 'slots');
    console.log('📋 All time slots:', conceptualTimeSlots.map(s => `${s.time} - ${s.activity}`));

    // Keep the first two activities from the preview
    const previewActivities = savedItinerary.activities.slice(0, 2);
    console.log('✅ Keeping preview activities:', previewActivities.map(a => a.name));
    console.log('📊 Preview activities count:', previewActivities.length);

    // Generate remaining activities based on the conceptual plan, skipping the first two
    const remainingTimeSlots = conceptualTimeSlots.slice(2);
    console.log('🔄 Remaining time slots to generate:', remainingTimeSlots.length);
    console.log('📋 Remaining slots:', remainingTimeSlots.map(s => `${s.time} - ${s.activity}`));
    
    let newActivities = [];

    if (remainingTimeSlots.length > 0) {
      console.log('🌍 Finding real locations for remaining time slots...');
      const remainingLocations = await findRealLocations(remainingTimeSlots, city);
      console.log('✅ Found locations:', remainingLocations.length);

      console.log('🎨 Generating descriptions and recommendations for remaining locations...');
      newActivities = await Promise.all(remainingLocations.map(async (slot) => {
        const place = slot.realPlace;
        
        const [description, recommendations] = await Promise.all([
          generateLocationDescription(place.name, place.address, slot.category, interests, audience, savedItinerary.conceptual_plan.concept),
          generateLocationRecommendations(place.name, slot.category, interests, audience, savedItinerary.conceptual_plan.concept)
        ]);

        const realPrice = calculateRealPrice(slot.category, place.priceLevel, city);
        const priceRange = formatPriceRange(slot.category, place.priceLevel, city);

        // Generate photos
        const photos = place.photos ? place.photos.slice(0, 5).map(photo => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
        ) : [];

        return {
          time: slot.time,
          name: place.name,
          title: place.name,
          description: description,
          category: slot.category,
          duration: 90,
          price: realPrice,
          location: place.address,
          photos: photos.length > 0 ? photos : [
            'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop&q=80'
          ],
          recommendations: recommendations,
          priceRange: priceRange,
          rating: place.rating
        };
      }));
      console.log('✅ Generated new activities:', newActivities.length);
      console.log('📋 New activities:', newActivities.map(a => `${a.time} - ${a.name}`));
    } else {
      console.warn('⚠️ No remaining time slots to generate! Total slots:', conceptualTimeSlots.length);
    }

    // Combine preview activities with newly generated activities
    const fullActivities = [...previewActivities, ...newActivities];
    console.log('✅ Combined full activities:', fullActivities.length, 'total');
    console.log('📋 Full activities list:', fullActivities.map(a => `${a.time} - ${a.name}`));

    // Recalculate total cost for the full plan
    const totalCost = fullActivities.reduce((sum, act) => sum + act.price, 0);
    const withinBudget = totalCost <= parseInt(budget);

    // Convert to display format (daily_plan) for frontend
    const dailyPlan = [{
      date: savedItinerary.date || date,
      blocks: fullActivities.map(activity => ({
        time: activity.time,
        items: [{
          title: activity.name || activity.title,
          why: activity.description,
          description: activity.description,
          category: activity.category,
          duration: `${activity.duration} min`,
          price: activity.price,
          location: activity.location,
          address: activity.location,
          photos: activity.photos ? activity.photos.map(photoUrl => ({
            url: photoUrl,
            thumbnail: photoUrl,
            source: 'google_places'
          })) : [],
          approx_cost: activity.priceRange || `€${activity.price}`,
          tips: activity.recommendations,
          rating: activity.rating
        }]
      }))
    }];

    const fullItinerary = {
      ...savedItinerary, // Keep existing meta info (title, subtitle, weather, etc.)
      activities: fullActivities, // Keep activities for backend processing
      daily_plan: dailyPlan, // Add converted daily_plan for frontend display
      totalCost,
      withinBudget,
      previewOnly: false // Mark as full plan
    };

    // Save the complete full itinerary back to Redis (OVERWRITE the preview)
    await redis.set(`itinerary:${itineraryId}`, JSON.stringify(fullItinerary), { ex: 60 * 60 * 24 * 30 });
    console.log(`✅ Full itinerary saved to Redis with ID: ${itineraryId}`);
    console.log(`📊 Full itinerary contains:`, {
      activitiesCount: fullActivities.length,
      dailyPlanBlocks: dailyPlan[0]?.blocks?.length || 0,
      totalItems: dailyPlan[0]?.blocks?.reduce((sum, block) => sum + (block.items?.length || 0), 0) || 0,
      hasDailyPlan: !!dailyPlan.length,
      previewOnly: false
    });
    console.log(`🔄 PREVIEW OVERWRITTEN: Old preview (2 locations) replaced with full day (${fullActivities.length} locations)`);

    return res.status(200).json({ success: true, itinerary: fullItinerary });

  } catch (error) {
    console.error('❌ COMPLETE ITINERARY ERROR:', error.message);
    console.error('❌ Stack trace:', error.stack);
    // Ensure CORS headers are set even in error responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.status(500).json({
      success: false,
      error: 'Failed to complete itinerary generation',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

