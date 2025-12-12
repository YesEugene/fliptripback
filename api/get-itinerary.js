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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Itinerary ID is required' });
    }

    const itineraryData = await redis.get(`itinerary:${id}`);

    if (itineraryData) {
      // Upstash Redis может вернуть уже распарсенный объект или строку
      const itinerary = typeof itineraryData === 'string' ? JSON.parse(itineraryData) : itineraryData;
      console.log(`✅ Itinerary loaded from Redis with ID: ${id}`);
      console.log(`📊 Itinerary previewOnly flag: ${itinerary.previewOnly}`);
      console.log(`📊 Itinerary activities count: ${itinerary.activities?.length || 0}`);
      return res.status(200).json({ success: true, itinerary });
    } else {
      console.log(`⚠️ Itinerary with ID: ${id} not found in Redis`);
      return res.status(404).json({ success: false, error: 'Itinerary not found' });
    }
  } catch (error) {
    console.error('❌ Error getting itinerary from Redis:', error);
    console.error('❌ Environment variables check:', {
      url: process.env.FTSTORAGE_KV_REST_API_URL ? 'set' : 'not set',
      token: process.env.FTSTORAGE_KV_REST_API_TOKEN ? 'set' : 'not set',
      altUrl: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'not set',
      altToken: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'not set',
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve itinerary', 
      details: error.message 
    });
  }
}

