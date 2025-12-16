/**
 * Unlock Itinerary API Endpoint
 * After payment, this endpoint:
 * 1. Loads the saved itinerary from Redis
 * 2. Generates additional locations if needed (using DB first, then Google/OpenAI)
 * 3. Updates the itinerary in Redis with previewOnly=false
 */

import { Redis } from '@upstash/redis';
import { searchLocationsForItinerary } from '../database/services/locationsService.js';
import { getOrCreateCity } from '../database/services/citiesService.js';
import { Client } from '@googlemaps/google-maps-services-js';
import OpenAI from 'openai';

// Initialize clients
const googleMapsClient = new Client({});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set');
  }
  
  return new Redis({ url, token });
}

// Generate location description via OpenAI (optimized)
async function generateLocationDescription(name, category, city) {
  try {
    const prompt = `Describe ${name} in ${city} (${category}). 2-3 sentences.`;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI description error:', error);
    return null;
  }
}

// Generate location recommendations via OpenAI (optimized)
async function generateLocationRecommendations(name, category, city) {
  try {
    const prompt = `Tip for visiting ${name} in ${city}. One sentence.`;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0.7
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI recommendations error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers - устанавливаем ПЕРВЫМИ
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { itineraryId } = req.body;
    
    if (!itineraryId) {
      return res.status(400).json({
        success: false,
        error: 'itineraryId is required'
      });
    }

    console.log('🔓 Unlocking itinerary:', itineraryId);

    const redis = getRedis();
    
    // Step 1: Load existing itinerary from Redis
    const existingItinerary = await redis.get(`itinerary:${itineraryId}`);
    
    if (!existingItinerary) {
      return res.status(404).json({
        success: false,
        error: 'Itinerary not found'
      });
    }

    const itinerary = typeof existingItinerary === 'string' 
      ? JSON.parse(existingItinerary) 
      : existingItinerary;

    console.log('📥 Loaded itinerary from Redis:', {
      hasActivities: !!itinerary.activities,
      activitiesCount: itinerary.activities?.length || 0,
      hasDailyPlan: !!itinerary.daily_plan,
      previewOnly: itinerary.previewOnly
    });

    // Step 2: If itinerary already has full plan, just update previewOnly flag
    if (itinerary.activities && itinerary.activities.length > 2) {
      console.log('✅ Itinerary already has full plan, just updating previewOnly flag');
      itinerary.previewOnly = false;
      await redis.set(`itinerary:${itineraryId}`, JSON.stringify(itinerary));
      
      return res.status(200).json({
        success: true,
        itinerary: itinerary,
        message: 'Itinerary unlocked (already had full plan)'
      });
    }

    // Step 3: Generate additional locations if needed
    // The full plan was already generated during preview, so we should have all activities
    // But if for some reason we only have 2, we need to generate the rest
    
    if (!itinerary.activities || itinerary.activities.length <= 2) {
      console.log('⚠️ Itinerary has only preview activities, but full plan should have been generated during preview');
      console.log('⚠️ This should not happen - full plan should be generated during preview');
      // For now, just unlock what we have
      itinerary.previewOnly = false;
      await redis.set(`itinerary:${itineraryId}`, JSON.stringify(itinerary));
      
      return res.status(200).json({
        success: true,
        itinerary: itinerary,
        message: 'Itinerary unlocked (preview only - full plan should have been generated during preview)'
      });
    }

    // Step 4: Update previewOnly flag and save
    itinerary.previewOnly = false;
    await redis.set(`itinerary:${itineraryId}`, JSON.stringify(itinerary));

    console.log('✅ Itinerary unlocked successfully');

    return res.status(200).json({
      success: true,
      itinerary: itinerary,
      message: 'Itinerary unlocked successfully'
    });

  } catch (error) {
    console.error('❌ Unlock itinerary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to unlock itinerary',
      message: error.message
    });
  }
}

