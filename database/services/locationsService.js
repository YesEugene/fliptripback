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
    if (interest_ids && Array.isArray(interest_ids) && interest_ids.length > 0) {
      // Filter out any invalid/null interest IDs (accept string, number, or UUID)
      const validInterestIds = interest_ids.filter(id => id != null && id !== '');
      console.log(`💾 Saving location with ${validInterestIds.length} interests:`, validInterestIds);
      if (validInterestIds.length > 0) {
        const interestRelations = validInterestIds.map(interestId => ({
          location_id: data.id,
          interest_id: String(interestId), // Ensure string format
          relevance_score: 5 // Default relevance
        }));
        const { error: interestsError } = await supabase.from('location_interests').insert(interestRelations);
        if (interestsError) {
          console.error('❌ Error inserting interests:', interestsError);
          // Don't fail the whole operation, just log the error
        } else {
          console.log(`✅ Successfully saved ${validInterestIds.length} interests for location ${data.id}`);
        }
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
      // Insert new interests if provided
      if (Array.isArray(interest_ids) && interest_ids.length > 0) {
        // Filter out any invalid/null interest IDs (accept string, number, or UUID)
        const validInterestIds = interest_ids.filter(id => id != null && id !== '');
        console.log(`💾 Updating location ${locationId} with ${validInterestIds.length} interests:`, validInterestIds);
        if (validInterestIds.length > 0) {
          const interestRelations = validInterestIds.map(interestId => ({
            location_id: locationId,
            interest_id: String(interestId), // Ensure string format
            relevance_score: 5 // Default relevance
          }));
          const { error: insertError } = await supabase.from('location_interests').insert(interestRelations);
          if (insertError) {
            console.error('❌ Error inserting interests:', insertError);
          } else {
            console.log(`✅ Successfully updated ${validInterestIds.length} interests for location ${locationId}`);
          }
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
 * Supports both interest_ids (new system) and tags (legacy)
 */
export async function searchLocationsForItinerary(cityId, categories = [], tags = [], interestIds = [], limit = 10) {
  try {
    let query = supabase
      .from('locations')
      .select(`
        *,
        city:cities(*),
        interests:location_interests(interest:interests(*, category:interest_categories(*), subcategory:interest_subcategories(*))),
        tags:location_tags(tag:tags(*)),
        photos:location_photos(*)
      `)
      .eq('city_id', cityId)
      // Search verified locations OR admin-created locations (both should be included)
      .or('verified.eq.true,source.eq.admin')
      .limit(limit * 2); // Get more to filter by interests

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data, error } = await query;
    
    console.log(`🔍 DB Query: cityId=${cityId}, categories=${categories.join(',')}, interestIds=${interestIds.length}, found ${data?.length || 0} locations`);

    if (error) throw error;

    let filtered = data || [];

    // Filter by interest_ids if provided (new system - preferred)
    if (interestIds.length > 0) {
      // Normalize interest IDs to strings for comparison
      const normalizedInterestIds = interestIds.map(id => String(id));
      console.log(`🔍 Filtering by interest_ids (normalized):`, normalizedInterestIds);
      console.log(`📊 Total locations before filtering: ${filtered.length}`);
      
      // Debug: Log all locations and their interests before filtering
      filtered.forEach(location => {
        const locationInterestIds = [];
        if (location.interests && Array.isArray(location.interests)) {
          location.interests.forEach(li => {
            if (li.interest && li.interest.id) {
              locationInterestIds.push(String(li.interest.id));
            } else if (li.interest_id) {
              locationInterestIds.push(String(li.interest_id));
            }
          });
        }
        console.log(`📍 Location "${location.name}" (ID: ${location.id}, verified: ${location.verified}, source: ${location.source}) has interest_ids: [${locationInterestIds.join(', ') || 'none'}]`);
      });
      
      filtered = filtered.filter(location => {
        // Extract interest IDs from the nested structure
        const locationInterestIds = [];
        if (location.interests && Array.isArray(location.interests)) {
          location.interests.forEach(li => {
            // Handle nested interest object structure from Supabase join
            if (li.interest && li.interest.id) {
              locationInterestIds.push(String(li.interest.id));
            } else if (li.interest_id) {
              locationInterestIds.push(String(li.interest_id));
            }
          });
        }
        
        // Location matches if it has at least one of the requested interests
        const matches = normalizedInterestIds.some(interestId => locationInterestIds.includes(interestId));
        if (matches) {
          console.log(`✅ Location "${location.name}" (ID: ${location.id}) MATCHES - has interests: [${locationInterestIds.join(', ')}]`);
        } else if (locationInterestIds.length > 0) {
          console.log(`❌ Location "${location.name}" (ID: ${location.id}) does NOT match - has: [${locationInterestIds.join(', ')}], need: [${normalizedInterestIds.join(', ')}]`);
        } else {
          console.log(`⚠️ Location "${location.name}" (ID: ${location.id}) has NO interests assigned`);
        }
        return matches;
      });
      console.log(`✅ Filtered by interest_ids: ${filtered.length} locations match out of ${data.length} total`);
      
      if (filtered.length === 0 && data.length > 0) {
        console.log(`⚠️⚠️⚠️ WARNING: No locations match the interest filter! This might indicate:`);
        console.log(`   1. Locations in DB don't have the selected interests assigned`);
        console.log(`   2. Interest IDs don't match (check if IDs are correct)`);
        console.log(`   3. Location-interests relationships are missing in location_interests table`);
      }
    } else {
      console.log(`⚠️ No interestIds provided, returning all locations (${filtered.length} total)`);
    }
    // Legacy: Filter by tags if provided (fallback)
    else if (tags.length > 0) {
      filtered = filtered.filter(location => {
        // Check interests first (new system)
        const locationInterests = location.interests?.map(li => li.interest?.name) || [];
        // Also check tags (legacy)
        const locationTags = location.tags?.map(lt => lt.tag?.name) || [];
        const allLocationTags = [...locationInterests, ...locationTags];
        return tags.some(tag => allLocationTags.includes(tag));
      });
    }

    // Limit results
    filtered = filtered.slice(0, limit);

    return { success: true, locations: filtered };
  } catch (error) {
    console.error('Search locations error:', error);
    return { success: false, error: error.message, locations: [] };
  }
}

