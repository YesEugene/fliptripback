/**
 * Tours Database Module - Create Tour Endpoint
 * Serverless function for guides to create tours (using PostgreSQL/Supabase)
 */

import { createTour } from '../database/services/toursService.js';
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
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
    // Проверка авторизации
    const guideId = getUserId(req);
    if (!guideId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    // Получение данных тура
    const tourData = req.body;

    // Get or create country and city
    let countryId = tourData.country_id || null;
    let cityId = tourData.city_id || null;

    if (tourData.country && !countryId) {
      countryId = await getOrCreateCountry(tourData.country);
    }

    if (tourData.city && !cityId) {
      cityId = await getOrCreateCity(tourData.city, countryId);
    }

    // Преобразование данных из формата frontend в формат БД
    const dbTourData = {
      country_id: countryId,
      city_id: cityId,
      title: tourData.title,
      description: tourData.description || '',
      preview_media_url: tourData.preview || '',
      preview_media_type: tourData.previewType || 'image',
      duration_type: tourData.duration?.type || 'hours',
      duration_value: tourData.duration?.value || 6,
      languages: tourData.languages || ['en'],
      default_format: tourData.withGuide ? 'with_guide' : 'self_guided',
      price_pdf: tourData.price?.pdfPrice || 16,
      price_guided: tourData.price?.guidedPrice || null,
      currency: tourData.price?.currency || 'USD',
      meeting_point: tourData.price?.meetingPoint || '',
      meeting_time: tourData.price?.meetingTime || '',
      available_dates: tourData.price?.availableDates || [],
      tags: tourData.tags || [],
      additionalOptions: tourData.additionalOptions || {
        platformOptions: ['insurance', 'accommodation'],
        creatorOptions: {}
      },
      daily_plan: tourData.daily_plan || []
    };

    // Создание тура в БД
    const result = await createTour(dbTourData, guideId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Error creating tour'
      });
    }

    res.status(200).json({
      success: true,
      tour: result.tour
    });
  } catch (error) {
    console.error('Create tour error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error creating tour',
      error: error.message 
    });
  }
}
