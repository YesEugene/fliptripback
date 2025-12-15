/**
 * Tours Database Module - Unified Tours Endpoint
 * Serverless function to get a single tour or list tours with filters (using PostgreSQL/Supabase)
 */

import { getTours, getTourById } from '../database/services/toursService.js';

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
    const { id, city, city_id, format, interests, audience, duration, languages, minPrice, maxPrice, limit = 50, offset = 0 } = req.query;

    // If ID is provided, return single tour
    if (id) {
      const result = await getTourById(id);
      
      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error || 'Tour not found'
        });
      }

      // Transform to frontend format
      const tour = result.tour;
      const transformedTour = {
        id: tour.id,
        guideId: tour.guide_id,
        country: tour.country?.name || '',
        city: tour.city?.name || '',
        title: tour.title,
        description: tour.description,
        preview: tour.preview_media_url,
        previewType: tour.preview_media_type,
        tags: tour.tags?.map(tt => tt.tag?.name).filter(Boolean) || [],
        duration: {
          type: tour.duration_type,
          value: tour.duration_value
        },
        languages: tour.languages || ['en'],
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
        additionalOptions: {
          platformOptions: tour.additional_options?.filter(opt => opt.option_type === 'platform').map(opt => opt.option_key) || ['insurance', 'accommodation'],
          creatorOptions: tour.additional_options?.filter(opt => opt.option_type === 'creator').reduce((acc, opt) => {
            acc[opt.option_key] = opt.option_price;
            return acc;
          }, {}) || {}
        },
        daily_plan: tour.daily_plan || [],
        status: tour.status,
        is_published: tour.is_published,
        createdAt: tour.created_at,
        updatedAt: tour.updated_at
      };

      return res.status(200).json({
        success: true,
        tour: transformedTour
      });
    }

    // Otherwise, return list of tours with filters
    const filters = {};
    
    if (city_id) {
      filters.city_id = city_id;
    } else if (city) {
      // TODO: Get city_id from city name
      // For now, we'll search by city name in the query
    }
    
    if (format) {
      filters.default_format = format;
    }
    
    if (status) {
      filters.status = status;
    }

    const result = await getTours(filters);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Error getting tours'
      });
    }

    // Transform tours to frontend format
    let transformedTours = (result.tours || []).map(tour => ({
      id: tour.id,
      guideId: tour.guide_id,
      country: tour.country?.name || '',
      city: tour.city?.name || '',
      title: tour.title,
      description: tour.description,
      preview: tour.preview_media_url,
      previewType: tour.preview_media_type,
      tags: tour.tags?.map(tt => tt.tag?.name).filter(Boolean) || [],
      duration: {
        type: tour.duration_type,
        value: tour.duration_value
      },
      languages: tour.languages || ['en'],
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

    // Apply additional filters that aren't in DB query
    if (interests) {
      const interestList = Array.isArray(interests) ? interests : interests.split(',');
      // Filter by tags (tags contain interests)
      transformedTours = transformedTours.filter(t => 
        t.tags?.some(tag => interestList.includes(tag))
      );
    }

    if (audience) {
      // TODO: Add audience to tours table or filter by tags
    }

    if (duration) {
      transformedTours = transformedTours.filter(t => 
        t.duration?.type === duration
      );
    }

    if (languages) {
      const langList = Array.isArray(languages) ? languages : languages.split(',');
      transformedTours = transformedTours.filter(t => 
        t.languages?.some(lang => langList.includes(lang))
      );
    }

    if (minPrice !== undefined) {
      transformedTours = transformedTours.filter(t => 
        (t.price?.pdfPrice || 0) >= parseFloat(minPrice)
      );
    }

    if (maxPrice !== undefined) {
      transformedTours = transformedTours.filter(t => 
        (t.price?.pdfPrice || 0) <= parseFloat(maxPrice)
      );
    }

    // Pagination
    const paginatedTours = transformedTours.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    return res.status(200).json({
      success: true,
      tours: paginatedTours,
      total: transformedTours.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Tours error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error getting tours',
      error: error.message 
    });
  }
}
