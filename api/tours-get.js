/**
 * Tours Database Module - Get Tour by ID Endpoint
 * Serverless function to get a single tour
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
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID тура обязателен' 
      });
    }

    const redis = getRedis();
    const tourKey = `tour:${id}`;
    const tourData = await redis.get(tourKey);

    if (!tourData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Тур не найден' 
      });
    }

    const tour = typeof tourData === 'string' ? JSON.parse(tourData) : tourData;

    res.status(200).json({
      success: true,
      tour
    });
  } catch (error) {
    console.error('Get tour error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка получения тура',
      error: error.message 
    });
  }
}

