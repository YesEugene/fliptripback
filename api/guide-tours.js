/**
 * Guide Dashboard Module - Get Guide's Tours
 * Serverless function to get all tours created by a guide (using PostgreSQL/Supabase)
 */

import { getTours } from '../database/services/toursService.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
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

    // Получение туров гида из БД
    const result = await getTours({ guide_id: guideId });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Error fetching tours'
      });
    }

    // Transform tours to match frontend format
    const transformedTours = (result.tours || []).map(tour => ({
      id: tour.id,
      title: tour.title,
      city: tour.city?.name || '',
      country: tour.country?.name || '',
      duration: {
        type: tour.duration_type,
        value: tour.duration_value
      },
      description: tour.description,
      preview: tour.preview_media_url,
      previewType: tour.preview_media_type,
      tags: tour.tags?.map(tt => tt.tag?.name).filter(Boolean) || [],
      format: tour.default_format,
      withGuide: tour.default_format === 'with_guide' || tour.default_format === 'both',
      price: {
        pdfPrice: tour.price_pdf,
        guidedPrice: tour.price_guided,
        currency: tour.currency,
        availableDates: tour.available_dates || [],
        meetingPoint: tour.meeting_point,
        meetingTime: tour.meeting_time
      },
      status: tour.status,
      is_published: tour.is_published,
      createdAt: tour.created_at,
      updatedAt: tour.updated_at
    }));

    res.status(200).json({
      success: true,
      tours: transformedTours,
      total: transformedTours.length
    });
  } catch (error) {
    console.error('Get guide tours error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching guide tours',
      error: error.message 
    });
  }
}
