// FlipTrip Clean Backend - Save Itinerary to Redis
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

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
  // CORS headers - УСТАНАВЛИВАЕМ ПЕРВЫМИ, ДО ЛЮБЫХ ДРУГИХ ОПЕРАЦИЙ
  // Это должно быть ДО любых try-catch или других операций
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight OPTIONS request - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    const { itinerary, itineraryId } = req.body;
    
    if (!itinerary) {
      return res.status(400).json({ success: false, error: 'Itinerary data is required' });
    }

    const id = itineraryId || uuidv4();
    
    // Сохраняем весь объект itinerary, включая флаг previewOnly и conceptual_plan.timeSlots
    await redis.set(`itinerary:${id}`, JSON.stringify(itinerary), { ex: 60 * 60 * 24 * 30 }); // 30 days expiration
    
    console.log(`✅ Itinerary saved to Redis with ID: ${id}`);
    return res.status(200).json({ success: true, itineraryId: id, itinerary });
  } catch (error) {
    console.error('❌ Error saving itinerary to Redis:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Environment variables check:', {
      url: process.env.FTSTORAGE_KV_REST_API_URL ? 'set' : 'not set',
      token: process.env.FTSTORAGE_KV_REST_API_TOKEN ? 'set' : 'not set',
      altUrl: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'not set',
      altToken: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'not set',
    });
    // Убеждаемся, что CORS headers установлены даже при ошибке
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    } catch (corsErr) {
      console.error('❌ Failed to set CORS headers in error handler:', corsErr);
    }
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to save itinerary', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

