// FlipTrip Clean Backend - Get Itinerary from Redis
import { Redis } from '@upstash/redis';

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
  // CORS headers - устанавливаем ПЕРВЫМИ (как в unlock-itinerary.js)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Itinerary ID is required' 
      });
    }

    // Try to get Redis client - handle errors gracefully
    let redis;
    try {
      redis = getRedis();
    } catch (redisError) {
      console.error('❌ Redis initialization error:', redisError);
      console.error('❌ Environment variables check:', {
        url: process.env.FTSTORAGE_KV_REST_API_URL ? 'set' : 'not set',
        token: process.env.FTSTORAGE_KV_REST_API_TOKEN ? 'set' : 'not set',
        altUrl: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'not set',
        altToken: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'not set',
        kvUrl: process.env.KV_REST_API_URL ? 'set' : 'not set',
        kvToken: process.env.KV_REST_API_TOKEN ? 'set' : 'not set',
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Redis not configured',
        message: redisError.message
      });
    }

    const itineraryString = await redis.get(`itinerary:${id}`);

    if (itineraryString) {
      let itinerary;
      try {
        itinerary = typeof itineraryString === 'string' 
          ? JSON.parse(itineraryString) 
          : itineraryString;
      } catch (parseError) {
        console.error('❌ Error parsing itinerary JSON:', parseError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to parse itinerary data' 
        });
      }
      
      console.log(`✅ Itinerary loaded from Redis with ID: ${id}`);
      return res.status(200).json({ 
        success: true, 
        itinerary 
      });
    } else {
      console.log(`⚠️ Itinerary with ID: ${id} not found in Redis`);
      return res.status(404).json({ 
        success: false, 
        error: 'Itinerary not found' 
      });
    }
  } catch (error) {
    console.error('❌ Error getting itinerary from Redis:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve itinerary', 
      message: error.message 
    });
  }
}

