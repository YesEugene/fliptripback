/**
 * Tours Database Module - Unified Tours Endpoint
 * Serverless function to get a single tour or list tours with filters
 * 
 * According to plan: Tours are permanent entities stored in PostgreSQL, not Redis
 * Redis is only for temporary data (itineraries, sessions)
 */

import { supabase } from '../database/db.js';

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
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { id } = req.query;

    // If ID is provided, return single tour from PostgreSQL
    if (id) {
      const { data: tour, error } = await supabase
        .from('tours')
        .select(`
          *,
          city:cities(name),
          tour_days(
            id,
            day_number,
            title,
            date_hint,
            tour_blocks(
              id,
              start_time,
              end_time,
              title,
              tour_items(
                id,
                location_id,
                custom_title,
                custom_description,
                custom_recommendations,
                order_index,
                duration_minutes,
                approx_cost,
                location:locations(*)
              )
            )
          ),
          tour_tags(
            tag:tags(id, name)
          ),
          guide:guides!tours_guide_id_fkey(
            id,
            name,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error || !tour) {
        return res.status(404).json({ 
          success: false, 
          message: 'Tour not found' 
        });
      }

      // Convert normalized structure to legacy format for backward compatibility
      const formattedTour = {
        ...tour,
        // Extract city name from city object if it exists
        city: tour.city?.name || tour.city || null,
        daily_plan: convertTourToDailyPlan(tour)
      };

      return res.status(200).json({
        success: true,
        tour: formattedTour
      });
    }

    // Otherwise, return list of tours with filters from PostgreSQL
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

    let query = supabase
      .from('tours')
      .select(`
        *,
        city:cities(name),
        tour_tags(
          tag:tags(id, name)
        ),
        guide:guides!tours_guide_id_fkey(
          id,
          name,
          avatar_url
        )
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (city) {
      // First, get city ID by name
      const { data: cityData } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', city)
        .limit(1)
        .maybeSingle();
      
      if (cityData && cityData.id) {
        query = query.eq('city_id', cityData.id);
      } else {
        // If city not found, return empty result
        return res.status(200).json({
          success: true,
          tours: [],
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      }
    }

    if (format) {
      query = query.eq('default_format', format);
    }

    if (minPrice !== undefined) {
      query = query.gte('price_pdf', parseFloat(minPrice));
    }

    if (maxPrice !== undefined) {
      query = query.lte('price_pdf', parseFloat(maxPrice));
    }

    const { data: tours, error } = await query;

    if (error) {
      throw error;
    }

    // Apply additional filters in memory (for complex filters)
    let filteredTours = tours || [];

    if (interests) {
      const interestList = Array.isArray(interests) ? interests : interests.split(',');
      filteredTours = filteredTours.filter(t => {
        const tourTagNames = (t.tour_tags || []).map(tt => tt.tag?.name).filter(Boolean);
        return interestList.some(interest => tourTagNames.includes(interest));
      });
    }

    if (audience) {
      // This would need to be stored in tours table or meta field
      // For now, skip this filter
    }

    if (duration) {
      filteredTours = filteredTours.filter(t => 
        t.duration_type === duration || 
        (duration === 'hours' && t.duration_value <= 12) ||
        (duration === 'days' && t.duration_type === 'days')
      );
    }

    // Convert to legacy format
    const formattedTours = filteredTours.map(tour => ({
      ...tour,
      daily_plan: [] // Would need to load full structure for this
    }));

    return res.status(200).json({
      success: true,
      tours: formattedTours,
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

// Helper function to convert normalized tour structure to daily_plan format
function convertTourToDailyPlan(tour) {
  if (!tour.tour_days || !Array.isArray(tour.tour_days)) {
    return [];
  }

  return tour.tour_days.map(day => {
    const blocks = (day.tour_blocks || []).map(block => {
      const items = (block.tour_items || []).map(item => {
        const location = item.location;
        return {
          title: item.custom_title || location?.name || '',
          address: location?.address || '',
          category: location?.category || '',
          why: item.custom_description || location?.description || '',
          tips: item.custom_recommendations || location?.recommendations || '',
          photos: location?.photos?.map(p => p.url) || [],
          cost: item.approx_cost || 0,
          duration: item.duration_minutes || null
        };
      });

      return {
        time: block.start_time && block.end_time 
          ? `${block.start_time} - ${block.end_time}`
          : block.start_time || 'TBD',
        title: block.title || null,
        items: items
      };
    });

    return {
      day: day.day_number,
      date: day.date_hint || null,
      title: day.title || null,
      blocks: blocks
    };
  });
}

