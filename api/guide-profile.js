/**
 * Guide Profile API Endpoint
 * Serverless function for managing guide profiles
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Проверка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization required' 
      });
    }

    const redis = getRedis();
    const userId = await verifyToken(authHeader, redis);
    if (!userId) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    // Проверка роли (только гиды могут управлять профилем)
    const userData = await redis.get(`user:${userId}`);
    if (!userData) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
    if (user.role !== 'guide') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(403).json({ 
        success: false, 
        message: 'Only guides can manage profiles' 
      });
    }

    const profileKey = `guide:${userId}:profile`;

    // GET - получение профиля
    if (req.method === 'GET') {
      const profileData = await redis.get(profileKey);
      
      if (!profileData) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profile not found' 
        });
      }

      const profile = typeof profileData === 'string' ? JSON.parse(profileData) : profileData;
      
      return res.status(200).json({
        success: true,
        profile
      });
    }

    // PUT - обновление/создание профиля
    if (req.method === 'PUT') {
      const profileData = req.body;

      // Нормализация данных профиля
      const normalizedProfile = {
        guideId: userId,
        avatar: profileData.avatar || '',
        bio: profileData.bio || '',
        socialLinks: {
          instagram: profileData.socialLinks?.instagram || '',
          facebook: profileData.socialLinks?.facebook || '',
          twitter: profileData.socialLinks?.twitter || '',
          linkedin: profileData.socialLinks?.linkedin || '',
          website: profileData.socialLinks?.website || ''
        },
        updatedAt: new Date().toISOString(),
        createdAt: profileData.createdAt || new Date().toISOString()
      };

      // Сохранение профиля в Redis
      await redis.set(profileKey, JSON.stringify(normalizedProfile));

      return res.status(200).json({
        success: true,
        profile: normalizedProfile
      });
    }

    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  } catch (error) {
    console.error('Guide profile error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message 
    });
  }
}

