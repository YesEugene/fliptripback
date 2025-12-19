// Locations Service - Database operations for locations
import { supabase } from '../db.js';

/**
 * Search locations for itinerary generation
 * @param {number} cityId - City ID
 * @param {string[]} categories - Categories to filter by
 * @param {string[]} tags - Tags to filter by
 * @param {number[]} interestIds - Interest IDs to filter by
 * @param {number} limit - Maximum number of results
 * @returns {Promise<{success: boolean, locations: any[]}>}
 */
export async function searchLocationsForItinerary(cityId, categories = [], tags = [], interestIds = [], limit = 10) {
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, returning empty results');
      return { success: false, locations: [] };
    }

    let query = supabase
      .from('locations')
      .select(`
        *,
        city:cities(name),
        interests:location_interests(
          interest:interests(id, name)
        ),
        photos:location_photos(url)
      `)
      .eq('city_id', cityId)
      .eq('verified', true)
      .limit(limit);

    // Filter by categories if provided
    if (categories && categories.length > 0) {
      query = query.in('category', categories);
    }

    // Filter by interest IDs if provided
    if (interestIds && interestIds.length > 0) {
      // This requires a join through location_interests
      // For now, we'll filter after fetching
      // TODO: Optimize with proper join query
    }

    const { data: locations, error } = await query;

    if (error) {
      console.error('❌ Error searching locations:', error);
      return { success: false, locations: [] };
    }

    // Filter by interest IDs if provided (post-query filter)
    let filteredLocations = locations || [];
    if (interestIds && interestIds.length > 0) {
      filteredLocations = filteredLocations.filter(location => {
        const locationInterestIds = (location.interests || []).map(li => 
          typeof li.interest === 'object' ? li.interest.id : li.interest
        ).map(id => String(id));
        return interestIds.some(id => locationInterestIds.includes(String(id)));
      });
    }

    // Filter by tags if provided (simple substring match)
    if (tags && tags.length > 0) {
      const tagLower = tags.map(t => t.toLowerCase());
      filteredLocations = filteredLocations.filter(location => {
        const locationTags = (location.tags || []).map(t => t.toLowerCase());
        const locationName = (location.name || '').toLowerCase();
        const locationDescription = (location.description || '').toLowerCase();
        
        return tagLower.some(tag => 
          locationTags.includes(tag) || 
          locationName.includes(tag) || 
          locationDescription.includes(tag)
        );
      });
    }

    return {
      success: true,
      locations: filteredLocations.slice(0, limit)
    };
  } catch (error) {
    console.error('❌ Error in searchLocationsForItinerary:', error);
    return { success: false, locations: [] };
  }
}


