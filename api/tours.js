/**
 * Tours Database Module - Unified Tours Endpoint
 * Serverless function to get a single tour or list tours with filters
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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    const { id } = req.query;

    // If ID is provided, return single tour
    if (id) {
      const tourKey = `tour:${id}`;
      const tourData = await redis.get(tourKey);

      if (!tourData) {
        return res.status(404).json({ 
          success: false, 
          message: 'Tour not found' 
        });
      }

      const tour = typeof tourData === 'string' ? JSON.parse(tourData) : tourData;

      return res.status(200).json({
        success: true,
        tour
      });
    }

    // Otherwise, return list of tours with filters
    const { 
      city, 
      format, 
      interests, 
      audience,
      duration,
      languages,
      minPrice,
      maxPrice,
      limit = 50,
      offset = 0
    } = req.query;

    // Определение набора туров для поиска
    let tourIds = [];
    
    if (city) {
      // Фильтр по городу
      const cityToursKey = `tours:city:${city}`;
      tourIds = await redis.smembers(cityToursKey);
    } else {
      // Все туры
      tourIds = await redis.smembers('tours:all');
    }

    // Получение туров
    const tours = [];
    for (const tourId of tourIds) {
      const tourData = await redis.get(`tour:${tourId}`);
      if (tourData) {
        const tour = typeof tourData === 'string' ? JSON.parse(tourData) : tourData;
        tours.push(tour);
      }
    }

    // Применение фильтров
    let filteredTours = tours;

    if (format) {
      filteredTours = filteredTours.filter(t => t.format === format);
    }

    if (interests) {
      const interestList = Array.isArray(interests) ? interests : interests.split(',');
      filteredTours = filteredTours.filter(t => 
        t.meta?.interests?.some(interest => interestList.includes(interest))
      );
    }

    if (audience) {
      filteredTours = filteredTours.filter(t => t.meta?.audience === audience);
    }

    if (duration) {
      filteredTours = filteredTours.filter(t => 
        t.duration?.type === duration || 
        (duration === 'hours' && t.duration?.value <= 12) ||
        (duration === 'days' && t.duration?.type === 'days')
      );
    }

    if (languages) {
      const langList = Array.isArray(languages) ? languages : languages.split(',');
      filteredTours = filteredTours.filter(t => 
        t.languages?.some(lang => langList.includes(lang))
      );
    }

    if (minPrice !== undefined) {
      filteredTours = filteredTours.filter(t => 
        t.price?.amount >= parseFloat(minPrice)
      );
    }

    if (maxPrice !== undefined) {
      filteredTours = filteredTours.filter(t => 
        t.price?.amount <= parseFloat(maxPrice)
      );
    }

    // Сортировка по дате создания (новые первыми)
    filteredTours.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Пагинация
    const paginatedTours = filteredTours.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );

    return res.status(200).json({
      success: true,
      tours: paginatedTours,
      total: filteredTours.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Tours error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting tours',
      error: error.message 
    });
  }
}

