/**
 * Tours Database Module - Create Tour Endpoint
 * Serverless function for guides to create tours
 */

import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

// Валидация структуры тура
function validateTourStructure(tour) {
  const requiredFields = ['id', 'guideId', 'title', 'city', 'duration', 'daily_plan', 'meta'];
  for (const field of requiredFields) {
    if (!tour[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }
  if (!Array.isArray(tour.daily_plan) || tour.daily_plan.length === 0) {
    console.error('daily_plan must be a non-empty array');
    return false;
  }
  for (const day of tour.daily_plan) {
    if (!day.blocks || !Array.isArray(day.blocks)) {
      console.error('Each day must have blocks array');
      return false;
    }
  }
  return true;
}

// Нормализация тура
function normalizeTour(tourData) {
  return {
    id: tourData.id || `tour-${Date.now()}`,
    guideId: tourData.guideId || null,
    title: tourData.title || '',
    city: tourData.city || '',
    duration: {
      type: tourData.duration?.type || 'hours',
      value: tourData.duration?.value || 6
    },
    languages: tourData.languages || ['en'],
    format: tourData.format || 'self-guided',
    additionalOptions: tourData.additionalOptions || [],
    price: {
      amount: tourData.price?.amount || 0,
      currency: tourData.price?.currency || 'EUR',
      format: tourData.price?.format || 'pdf'
    },
    daily_plan: tourData.daily_plan || [],
    meta: {
      interests: tourData.meta?.interests || [],
      audience: tourData.meta?.audience || 'him',
      total_estimated_cost: tourData.meta?.total_estimated_cost || '€0',
      weather: tourData.meta?.weather || null
    },
    createdAt: tourData.createdAt || new Date().toISOString(),
    updatedAt: tourData.updatedAt || new Date().toISOString()
  };
}

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
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

    // Проверка роли (только гиды могут создавать туры)
    const userData = await redis.get(`user:${userId}`);
    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Пользователь не найден' 
      });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
    if (user.role !== 'guide') {
      return res.status(403).json({ 
        success: false, 
        message: 'Только гиды могут создавать туры' 
      });
    }

    // Получение данных тура
    const tourData = req.body;

    // Нормализация тура
    const normalizedTour = normalizeTour({
      ...tourData,
      id: `tour-${uuidv4()}`,
      guideId: userId
    });

    // Валидация структуры
    if (!validateTourStructure(normalizedTour)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Неверная структура тура' 
      });
    }

    // Сохранение тура в Redis
    const tourKey = `tour:${normalizedTour.id}`;
    await redis.set(tourKey, JSON.stringify(normalizedTour));

    // Добавление тура в список туров гида
    const guideToursKey = `guide:${userId}:tours`;
    await redis.sadd(guideToursKey, normalizedTour.id);

    // Добавление тура в общий индекс по городу
    const cityToursKey = `tours:city:${normalizedTour.city}`;
    await redis.sadd(cityToursKey, normalizedTour.id);

    // Добавление в общий индекс всех туров
    await redis.sadd('tours:all', normalizedTour.id);

    res.status(200).json({
      success: true,
      tour: normalizedTour
    });
  } catch (error) {
    console.error('Create tour error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка создания тура',
      error: error.message 
    });
  }
}

