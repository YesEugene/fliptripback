/**
 * Auth Module - Get Current User Endpoint
 * Serverless function to get current authenticated user
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
  
  // Remove 'Bearer ' prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
  
  // Get user ID from token
  const userId = await redis.get(`token:${cleanToken}`);
  return userId;
}

export default async function handler(req, res) {
  // CORS headers - устанавливаем в самом начале, ДО любых других операций
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Обработка preflight запроса - возвращаем сразу, БЕЗ вызова getRedis()
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Токен не предоставлен' 
      });
    }

    const redis = getRedis();

    // Verify token
    const userId = await verifyToken(authHeader, redis);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный или истекший токен' 
      });
    }

    // Get user data
    const userData = await redis.get(`user:${userId}`);
    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Пользователь не найден' 
      });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // Return user data (without password)
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка получения данных пользователя',
      error: error.message 
    });
  }
}

