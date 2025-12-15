/**
 * Tours Database Module - Update and Delete Tour Endpoint
 * Serverless function to update or delete an existing tour
 */

import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set');
  }
  
  return new Redis({ url, token });
}

// Extract user ID from Authorization header
function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.replace('Bearer ', '');
    // Simple JWT decode (without verification for now)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId || payload.id || null;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

// Нормализация тура
function normalizeTour(tourData) {
  // Handle legacy data structure (backward compatibility)
  const legacyPrice = tourData.price?.amount !== undefined;
  const legacyOptions = Array.isArray(tourData.additionalOptions);
  
  return {
    id: tourData.id || `tour-${Date.now()}`,
    guideId: tourData.guideId || null,
    country: tourData.country || '', // New: Country field
    city: tourData.city || '',
    title: tourData.title || '',
    description: tourData.description || '', // New: Tour description
    preview: tourData.preview || '', // New: Preview image/video (base64 or URL)
    previewType: tourData.previewType || 'image', // 'image' or 'video'
    tags: tourData.tags || [], // New: Tags array
    duration: {
      type: tourData.duration?.type || 'hours',
      value: tourData.duration?.value || 6
    },
    languages: tourData.languages || ['en'],
    format: tourData.format || 'self-guided', // Can be 'self-guided' or 'guided' (or both)
    withGuide: tourData.withGuide !== undefined ? tourData.withGuide : (tourData.format === 'guided'), // Checkbox for "With Guide" option
    // Updated price structure
    price: legacyPrice ? {
      pdfPrice: tourData.price?.format === 'pdf' ? (tourData.price?.amount || 16) : 16,
      guidedPrice: tourData.price?.format === 'guided' ? (tourData.price?.amount || 0) : 0,
      currency: tourData.price?.currency || 'USD',
      availableDates: tourData.price?.availableDates || [],
      meetingPoint: tourData.price?.meetingPoint || '',
      meetingTime: tourData.price?.meetingTime || ''
    } : {
      pdfPrice: tourData.price?.pdfPrice || 16,
      guidedPrice: tourData.price?.guidedPrice || 0,
      currency: tourData.price?.currency || 'USD',
      availableDates: tourData.price?.availableDates || [],
      meetingPoint: tourData.price?.meetingPoint || '',
      meetingTime: tourData.price?.meetingTime || ''
    },
    // Split additional options
    additionalOptions: legacyOptions ? {
      platformOptions: ['insurance', 'accommodation'], // Always available from platform
      creatorOptions: tourData.additionalOptions
        .filter(id => ['photography', 'food', 'transport'].includes(id))
        .reduce((acc, id) => ({ ...acc, [id]: 0 }), {}) // Convert array to object with default price 0
    } : (tourData.additionalOptions || {
      platformOptions: ['insurance', 'accommodation'],
      creatorOptions: {}
    }),
    daily_plan: tourData.daily_plan || [],
    meta: {
      interests: tourData.meta?.interests || [],
      audience: tourData.meta?.audience || 'him',
      total_estimated_cost: tourData.meta?.total_estimated_cost || '€0',
      weather: tourData.meta?.weather || null
    },
    createdAt: tourData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Валидация структуры тура
function validateTourStructure(tour) {
  if (!tour.title || !tour.city) {
    return false;
  }
  if (!tour.duration || !tour.duration.type || !tour.duration.value) {
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  // CORS headers - ВСЕГДА устанавливаем первыми
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, DELETE, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.end();
    return;
  }

  // Handle DELETE request
  if (req.method === 'DELETE') {
    try {
      const redis = getRedis();
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tour ID is required' 
        });
      }

      // Получение существующего тура
      const tourKey = `tour:${id}`;
      const existingTourData = await redis.get(tourKey);

      if (!existingTourData) {
        return res.status(404).json({ 
          success: false, 
          message: 'Tour not found' 
        });
      }

      const existingTour = typeof existingTourData === 'string' 
        ? JSON.parse(existingTourData) 
        : existingTourData;

      // Проверка прав доступа (только создатель тура может его удалить, если удалось определить пользователя)
      const userId = getUserId(req);
      if (userId && existingTour.guideId && existingTour.guideId !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only delete your own tours' 
        });
      }

      // Удаление тура из Redis
      await redis.del(tourKey);

      // Удаление из индекса города
      if (existingTour.city) {
        const cityToursKey = `tours:city:${existingTour.city}`;
        await redis.srem(cityToursKey, id);
      }

      // Удаление из индекса гида
      if (existingTour.guideId) {
        const guideToursKey = `guide:${existingTour.guideId}:tours`;
        await redis.srem(guideToursKey, id);
      }

      res.status(200).json({
        success: true,
        message: 'Tour deleted successfully'
      });
    } catch (error) {
      console.error('Delete tour error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error deleting tour',
        error: error.message 
      });
    }
    return;
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tour ID is required' 
      });
    }

    // Проверка авторизации
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    // Получение существующего тура
    const tourKey = `tour:${id}`;
    const existingTourData = await redis.get(tourKey);

    if (!existingTourData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tour not found' 
      });
    }

    const existingTour = typeof existingTourData === 'string' 
      ? JSON.parse(existingTourData) 
      : existingTourData;

    // Проверка прав доступа (только создатель тура может его редактировать)
    if (existingTour.guideId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only edit your own tours' 
      });
    }

    // Получение данных тура для обновления
    const tourData = req.body;

    // Нормализация тура с сохранением оригинальных полей
    const normalizedTour = normalizeTour({
      ...existingTour, // Сохраняем существующие данные
      ...tourData,     // Обновляем новыми данными
      id: existingTour.id, // Сохраняем оригинальный ID
      guideId: existingTour.guideId, // Сохраняем оригинального гида
      createdAt: existingTour.createdAt, // Сохраняем дату создания
      updatedAt: new Date().toISOString() // Обновляем дату изменения
    });

    // Валидация структуры
    if (!validateTourStructure(normalizedTour)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tour structure' 
      });
    }

    // Обновление тура в Redis
    await redis.set(tourKey, JSON.stringify(normalizedTour));

    // Если город изменился, обновляем индексы
    if (existingTour.city !== normalizedTour.city) {
      // Удаляем из старого индекса города
      const oldCityToursKey = `tours:city:${existingTour.city}`;
      await redis.srem(oldCityToursKey, normalizedTour.id);
      
      // Добавляем в новый индекс города
      const newCityToursKey = `tours:city:${normalizedTour.city}`;
      await redis.sadd(newCityToursKey, normalizedTour.id);
    }

    res.status(200).json({
      success: true,
      tour: normalizedTour
    });
  } catch (error) {
    console.error('Update tour error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating tour',
      error: error.message 
    });
  }
}

