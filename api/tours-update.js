/**
 * Tours Database Module - Update and Delete Tour Endpoint
 * Serverless function to update or delete an existing tour (using PostgreSQL/Supabase)
 */

import { updateTour, deleteTour } from '../database/services/toursService.js';
import { getOrCreateCountry, getOrCreateCity } from '../database/services/citiesService.js';

// Extract user ID from Authorization header
function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.replace('Bearer ', '');
    // Decode token (simple base64 for now)
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload.userId || payload.id || null;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers - ВСЕГДА устанавливаем первыми
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, DELETE, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle DELETE request
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tour ID is required' 
        });
      }

      const guideId = getUserId(req);
      if (!guideId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const result = await deleteTour(id, guideId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Delete tour error:', error);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ 
        success: false, 
        message: 'Error deleting tour',
        error: error.message 
      });
    }
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tour ID is required' 
      });
    }

    // Проверка авторизации
    const guideId = getUserId(req);
    if (!guideId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    // Получение данных тура для обновления
    const tourData = req.body;

    // Get or create country and city if needed
    let countryId = tourData.country_id || null;
    let cityId = tourData.city_id || null;

    if (tourData.country && !countryId) {
      countryId = await getOrCreateCountry(tourData.country);
    }

    if (tourData.city && !cityId) {
      cityId = await getOrCreateCity(tourData.city, countryId);
    }

    // Add country_id and city_id to tourData if found
    if (countryId) tourData.country_id = countryId;
    if (cityId) tourData.city_id = cityId;

    // Обновление тура в БД
    const result = await updateTour(id, tourData, guideId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Error updating tour'
      });
    }

    res.status(200).json({
      success: true,
      tour: result.tour
    });
  } catch (error) {
    console.error('Update tour error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error updating tour',
      error: error.message 
    });
  }
}
