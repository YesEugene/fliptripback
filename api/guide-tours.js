/**
 * Guide Dashboard Module - Get Guide's Tours
 * Serverless function to get all tours created by a guide
 */

import { Redis } from '@upstash/redis';

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set');
  }
  
  return new Redis({ url, token });
}

// Verify token and get user ID
async function verifyToken(token, redis) {
  if (!token) return null;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
  const userId = await redis.get(`token:${cleanToken}`);
  return userId;
}

export default async function handler(req, res) {
  // CORS headers - ВСЕГДА устанавливаем первыми
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Проверка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Требуется авторизация' 
      });
    }

    const redis = getRedis();
    const userId = await verifyToken(authHeader, redis);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный или истекший токен' 
      });
    }

    // Получение списка туров гида
    const guideToursKey = `guide:${userId}:tours`;
    const tourIds = await redis.smembers(guideToursKey);

    // Получение данных туров
    const tours = [];
    for (const tourId of tourIds) {
      const tourData = await redis.get(`tour:${tourId}`);
      if (tourData) {
        const tour = typeof tourData === 'string' ? JSON.parse(tourData) : tourData;
        tours.push(tour);
      }
    }

    // Сортировка по дате создания (новые первыми)
    tours.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,
      tours,
      total: tours.length
    });
  } catch (error) {
    console.error('Get guide tours error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка получения туров гида',
      error: error.message 
    });
  }
}

