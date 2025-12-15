/**
 * Locations Service - Database operations for locations
 */

import { supabase } from '../db.js';

/**
 * Get all locations with filters
 */
export async function getLocations(filters = {}) {
  try {
    let query = supabase
      .from('locations')
      .select(`
        *,
        city:cities(name, country:countries(name)),
        tags:location_tags(tag:tags(*))
      `);

    if (filters.city_id) {
      query = query.eq('city_id', filters.city_id);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.verified !== undefined) {
      query = query.eq('verified', filters.verified);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, locations: data || [] };
  } catch (error) {
    console.error('Get locations error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get location by ID
 */
export async function getLocationById(locationId) {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        city:cities(*, country:countries(*)),
        photos:location_photos(*),
        interests:location_interests(interest:interests(*, category:interest_categories(*), subcategory:interest_subcategories(*))),
        tags:location_tags(tag:tags(*))
      `)
      .eq('id', locationId)
      .single();

    if (error) throw error;
    return { success: true, location: data };
  } catch (error) {
    console.error('Get location error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create location
 */
export async function createLocation(locationData, userId = null) {
  try {
    // Remove interest_ids and tag_ids from location data (handled separately)
    const { interest_ids, tag_ids, ...locationFields } = locationData;
    
    const location = {
      ...locationFields,
      created_by: userId,
      updated_by: userId
    };

    const { data, error } = await supabase
      .from('locations')
      .insert(location)
      .select()
      .single();

    if (error) throw error;

    // Add interests if provided (new system)
    if (interest_ids && interest_ids.length > 0) {
      const interestRelations = interest_ids.map(interestId => ({
        location_id: data.id,
        interest_id: interestId,
        relevance_score: 5 // Default relevance
      }));
      const { error: interestsError } = await supabase.from('location_interests').insert(interestRelations);
      if (interestsError) {
        console.error('Error inserting interests:', interestsError);
        // Don't fail the whole operation, just log the error
      }
    }
    
    // Legacy: Add tags if provided (for backward compatibility)
    if (tag_ids && tag_ids.length > 0) {
      const tagRelations = tag_ids.map(tagId => ({
        location_id: data.id,
        tag_id: tagId
      }));
      const { error: tagsError } = await supabase.from('location_tags').insert(tagRelations);
      if (tagsError) {
        console.error('Error inserting tags:', tagsError);
        // Don't fail the whole operation, just log the error
      }
    }

    return { success: true, location: data };
  } catch (error) {
    console.error('Create location error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update location
 */
export async function updateLocation(locationId, locationData, userId = null) {
  try {
    // Remove interest_ids and tag_ids from update data (handled separately)
    const { interest_ids, tag_ids, ...updateFields } = locationData;
    
    const updateData = {
      ...updateFields,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('locations')
      .update(updateData)
      .eq('id', locationId)
      .select()
      .single();

    if (error) throw error;

    // Update interests if provided (new system)
    if (interest_ids !== undefined) {
      // Delete existing interests
      const { error: deleteError } = await supabase.from('location_interests').delete().eq('location_id', locationId);
      if (deleteError) {
        console.error('Error deleting interests:', deleteError);
      }
      // Insert new interests
      if (interest_ids.length > 0) {
        const interestRelations = interest_ids.map(interestId => ({
          location_id: locationId,
          interest_id: interestId,
          relevance_score: 5 // Default relevance
        }));
        const { error: insertError } = await supabase.from('location_interests').insert(interestRelations);
        if (insertError) {
          console.error('Error inserting interests:', insertError);
        }
      }
    }
    
    // Legacy: Update tags if provided (for backward compatibility)
    if (tag_ids !== undefined) {
      // Delete existing tags
      const { error: deleteError } = await supabase.from('location_tags').delete().eq('location_id', locationId);
      if (deleteError) {
        console.error('Error deleting tags:', deleteError);
      }
      // Insert new tags
      if (tag_ids.length > 0) {
        const tagRelations = tag_ids.map(tagId => ({
          location_id: locationId,
          tag_id: tagId
        }));
        const { error: insertError } = await supabase.from('location_tags').insert(tagRelations);
        if (insertError) {
          console.error('Error inserting tags:', insertError);
        }
      }
    }

    return { success: true, location: data };
  } catch (error) {
    console.error('Update location error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete location
 */
export async function deleteLocation(locationId) {
  try {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete location error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search locations by city and category (for itinerary generation)
 */
export async function searchLocationsForItinerary(cityId, categories = [], tags = [], limit = 10) {
  try {
    let query = supabase
      .from('locations')
      .select(`
        *,
        city:cities(*),
        tags:location_tags(tag:tags(*)),
        photos:location_photos(*)
      `)
      .eq('city_id', cityId)
      // Search verified locations OR admin-created locations (both should be included)
      .or('verified.eq.true,source.eq.admin')
      .limit(limit);

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data, error } = await query;
    
    console.log(`🔍 DB Query: cityId=${cityId}, categories=${categories.join(',')}, found ${data?.length || 0} locations`);

    if (error) throw error;

    // Filter by interests if provided (new system)
    let filtered = data || [];
    if (tags.length > 0) {
      filtered = filtered.filter(location => {
        // Check interests first (new system)
        const locationInterests = location.interests?.map(li => li.interest?.name) || [];
        // Also check tags (legacy)
        const locationTags = location.tags?.map(lt => lt.tag?.name) || [];
        const allLocationTags = [...locationInterests, ...locationTags];
        return tags.some(tag => allLocationTags.includes(tag));
      });
    }

    return { success: true, locations: filtered };
  } catch (error) {
    console.error('Search locations error:', error);
    return { success: false, error: error.message, locations: [] };
  }
}

