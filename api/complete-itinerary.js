/**
 * Complete Itinerary Endpoint
 * Generates remaining locations after payment (completes preview to full plan)
 */

import { Redis } from '@upstash/redis';
import { findRealLocations, generateLocationDescription, generateLocationRecommendations, calculateRealPrice, formatPriceRange } from './smart-itinerary.js';

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set');
  }
  
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  // CORS headers - ВСЕГДА устанавливаем первыми
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { itineraryId, city, audience, interests, date, budget } = req.body;

    if (!itineraryId) {
      return res.status(400).json({ success: false, message: 'Itinerary ID is required' });
    }

    const redis = getRedis();

    // Load preview itinerary from Redis
    const previewData = await redis.get(`itinerary:${itineraryId}`);
    if (!previewData) {
      return res.status(404).json({ success: false, message: 'Preview itinerary not found' });
    }

    const preview = typeof previewData === 'string' ? JSON.parse(previewData) : previewData;

    if (!preview.conceptual_plan || !preview.conceptual_plan.timeSlots) {
      return res.status(400).json({ success: false, message: 'Invalid preview structure' });
    }

    // Get remaining time slots (skip first 2 that were already generated)
    const remainingTimeSlots = preview.conceptual_plan.timeSlots.slice(2);

    if (remainingTimeSlots.length === 0) {
      // Already complete, just update previewOnly flag
      const updatedItinerary = {
        ...preview,
        previewOnly: false
      };
      await redis.set(`itinerary:${itineraryId}`, JSON.stringify(updatedItinerary), { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ success: true, itinerary: updatedItinerary });
    }

    console.log(`🔄 Generating ${remainingTimeSlots.length} remaining locations...`);

    // Find real locations for remaining slots
    const remainingLocations = await findRealLocations(remainingTimeSlots, city || preview.city);

    // Generate descriptions and recommendations for remaining locations
    const remainingActivities = await Promise.all(remainingLocations.map(async (slot) => {
      const place = slot.realPlace;
      
      // Use description and recommendations from DB if available, otherwise generate
      let description = place.description;
      let recommendations = place.recommendations;
      
      if (!description || !recommendations) {
        const [generatedDescription, generatedRecommendations] = await Promise.all([
          description ? Promise.resolve(description) : generateLocationDescription(place.name, place.address, slot.category, interests || preview.meta?.interests || [], audience || preview.meta?.audience || 'him', preview.conceptual_plan?.concept || ''),
          recommendations ? Promise.resolve(recommendations) : generateLocationRecommendations(place.name, slot.category, interests || preview.meta?.interests || [], audience || preview.meta?.audience || 'him', preview.conceptual_plan?.concept || '')
        ]);
        
        description = generatedDescription;
        recommendations = generatedRecommendations;
      }

      const realPrice = calculateRealPrice(slot.category, place.priceLevel, city || preview.city);
      const priceRange = formatPriceRange(slot.category, place.priceLevel, city || preview.city);

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

    // Get existing activities from preview
    const existingActivities = preview.activities || [];
    
    // Combine existing (first 2) with new activities
    const allActivities = [...existingActivities, ...remainingActivities];

    // Convert to daily_plan format
    const daily_plan = [{
      day: 1,
      date: date || preview.date,
      blocks: allActivities.map((activity, index) => ({
        time: activity.time,
        title: activity.title || activity.name,
        items: [{
          title: activity.name,
          description: activity.description,
          recommendations: activity.recommendations,
          category: activity.category,
          duration: activity.duration,
          approx_cost: activity.price,
          location: activity.location,
          photos: activity.photos,
          rating: activity.rating
        }]
      }))
    }];

    // Update itinerary with full plan
    const fullItinerary = {
      ...preview,
      activities: allActivities,
      daily_plan: daily_plan,
      previewOnly: false
    };

    // Save full itinerary back to Redis
    await redis.set(`itinerary:${itineraryId}`, JSON.stringify(fullItinerary), { ex: 60 * 60 * 24 * 30 });

    console.log(`✅ Full itinerary saved with ${allActivities.length} activities`);

    res.status(200).json({
      success: true,
      itinerary: fullItinerary
    });
  } catch (error) {
    console.error('Complete itinerary error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      message: 'Error completing itinerary',
      error: error.message
    });
  }
}

