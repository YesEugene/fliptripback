// Tours Service - Database operations for tours
import { supabase } from '../db.js';

/**
 * Search tours for itinerary generation
 * @param {number} cityId - City ID
 * @param {string[]} categories - Categories to filter by
 * @param {string[]} tags - Tags to filter by
 * @param {number[]} interestIds - Interest IDs to filter by
 * @param {string} format - Tour format (self_guided, with_guide)
 * @param {number} budget - Budget limit
 * @param {number} limit - Maximum number of results
 * @returns {Promise<{success: boolean, tours: any[]}>}
 */
export async function searchToursForItinerary(cityId, categories = [], tags = [], interestIds = [], format = null, budget = null, limit = 10) {
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, returning empty results');
      return { success: false, tours: [] };
    }

    // Base query: get published and verified tours for the city
    let query = supabase
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
              location:locations(
                id,
                name,
                address,
                category,
                description,
                recommendations,
                photos:location_photos(url)
              )
            )
          )
        ),
        tour_tags(
          tag:tags(id, name)
        )
      `)
      .eq('city_id', cityId)
      .eq('is_published', true)
      .or('source.is.null,source.neq.user_generated') // Exclude AI-generated user tours, but include NULL (existing tours)
      .limit(limit);

    // Filter by format if provided
    if (format) {
      query = query.eq('default_format', format);
    }

    // Filter by budget if provided
    if (budget) {
      // For self_guided, check price_pdf
      // For with_guide, check price_guided
      if (format === 'self_guided') {
        query = query.lte('price_pdf', budget * 1.3); // Allow 30% deviation
      } else if (format === 'with_guide') {
        query = query.lte('price_guided', budget * 1.3);
      }
    }

    const { data: tours, error } = await query;

    if (error) {
      console.error('❌ Error searching tours:', error);
      return { success: false, tours: [] };
    }

    // Post-query filtering by tags and interests
    let filteredTours = tours || [];

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      const tagLower = tags.map(t => t.toLowerCase());
      filteredTours = filteredTours.filter(tour => {
        const tourTagNames = (tour.tour_tags || []).map(tt => 
          (tt.tag?.name || '').toLowerCase()
        );
        return tagLower.some(tag => tourTagNames.includes(tag));
      });
    }

    // Filter by interest IDs if provided
    // This requires checking locations within tour_items
    if (interestIds && interestIds.length > 0) {
      filteredTours = filteredTours.filter(tour => {
        // Get all location IDs from tour_items
        const locationIds = [];
        (tour.tour_days || []).forEach(day => {
          (day.tour_blocks || []).forEach(block => {
            (block.tour_items || []).forEach(item => {
              if (item.location_id) {
                locationIds.push(item.location_id);
              }
            });
          });
        });

        // TODO: Check if any of these locations have matching interests
        // For now, we'll return all tours if they have locations
        return locationIds.length > 0;
      });
    }

    return {
      success: true,
      tours: filteredTours.slice(0, limit)
    };
  } catch (error) {
    console.error('❌ Error in searchToursForItinerary:', error);
    return { success: false, tours: [] };
  }
}

/**
 * Get tour by ID with full structure
 */
export async function getTourById(tourId) {
  try {
    if (!supabase) {
      return { success: false, tour: null };
    }

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
        )
      `)
      .eq('id', tourId)
      .single();

    if (error) {
      console.error('❌ Error getting tour:', error);
      return { success: false, tour: null };
    }

    return { success: true, tour };
  } catch (error) {
    console.error('❌ Error in getTourById:', error);
    return { success: false, tour: null };
  }
}

