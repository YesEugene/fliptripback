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
    const { itineraryId } = req.body;

    if (!itineraryId) {
      return res.status(400).json({ success: false, message: 'Itinerary ID is required' });
    }

    const redis = getRedis();

    // Load existing itinerary from Redis
    const itineraryData = await redis.get(`itinerary:${itineraryId}`);
    if (!itineraryData) {
      return res.status(404).json({ success: false, message: 'Itinerary not found' });
    }

    const itinerary = typeof itineraryData === 'string' ? JSON.parse(itineraryData) : itineraryData;

    // Simply update previewOnly flag to false
    const unlockedItinerary = {
      ...itinerary,
      previewOnly: false
    };

    // Save back to Redis
    await redis.set(`itinerary:${itineraryId}`, JSON.stringify(unlockedItinerary), { ex: 60 * 60 * 24 * 30 });

    console.log(`✅ Itinerary ${itineraryId} unlocked (previewOnly set to false)`);
    console.log(`📊 Unlocked itinerary has ${unlockedItinerary.activities?.length || 0} activities, ${unlockedItinerary.daily_plan?.[0]?.blocks?.length || 0} blocks`);

    res.status(200).json({
      success: true,
      itinerary: unlockedItinerary
    });
  } catch (error) {
    console.error('Unlock itinerary error:', error);
    // Убеждаемся, что CORS заголовки установлены даже при ошибке
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(500).json({
      success: false,
      message: 'Error unlocking itinerary',
      error: error.message
    });
  }
}

