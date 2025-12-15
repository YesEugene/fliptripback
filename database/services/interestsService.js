/**
 * Interests Service - Database operations for interests system
 */

import { supabase } from '../db.js';

/**
 * Get all categories with full structure
 */
export async function getInterestsStructure() {
  try {
    const { data: categories, error: categoriesError } = await supabase
      .from('interest_categories')
      .select(`
        *,
        subcategories:interest_subcategories(
          *,
          interests:interests(*)
        )
      `)
      .order('display_order', { ascending: true });

    if (categoriesError) throw categoriesError;

    // Get direct interests (without subcategory)
    const { data: directInterests, error: directError } = await supabase
      .from('interests')
      .select('*')
      .is('subcategory_id', null)
      .order('display_order', { ascending: true });

    if (directError) throw directError;

    // Group direct interests by category
    const categoriesWithDirect = categories.map(category => ({
      ...category,
      subcategories: category.subcategories || [],
      direct_interests: directInterests.filter(interest => interest.category_id === category.id)
    }));

    return { success: true, categories: categoriesWithDirect };
  } catch (error) {
    console.error('Get interests structure error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get interests for a category
 */
export async function getInterestsByCategory(categoryId) {
  try {
    const { data, error } = await supabase
      .from('interests')
      .select('*')
      .eq('category_id', categoryId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return { success: true, interests: data || [] };
  } catch (error) {
    console.error('Get interests by category error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get interests for a subcategory
 */
export async function getInterestsBySubcategory(subcategoryId) {
  try {
    const { data, error } = await supabase
      .from('interests')
      .select('*')
      .eq('subcategory_id', subcategoryId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return { success: true, interests: data || [] };
  } catch (error) {
    console.error('Get interests by subcategory error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get interests for a location
 */
export async function getLocationInterests(locationId) {
  try {
    const { data, error } = await supabase
      .from('location_interests')
      .select(`
        *,
        interest:interests(
          *,
          category:interest_categories(*),
          subcategory:interest_subcategories(*)
        )
      `)
      .eq('location_id', locationId)
      .order('relevance_score', { ascending: false });

    if (error) throw error;
    return { success: true, interests: data || [] };
  } catch (error) {
    console.error('Get location interests error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set interests for a location
 */
export async function setLocationInterests(locationId, interestIds) {
  try {
    // Remove existing interests
    await supabase.from('location_interests').delete().eq('location_id', locationId);

    // Add new interests
    if (interestIds && interestIds.length > 0) {
      const locationInterests = interestIds.map(interestId => ({
        location_id: locationId,
        interest_id: interestId,
        relevance_score: 5 // Default relevance
      }));

      const { error } = await supabase.from('location_interests').insert(locationInterests);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Set location interests error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get interests for a tour
 */
export async function getTourInterests(tourId) {
  try {
    const { data, error } = await supabase
      .from('tour_interests')
      .select(`
        *,
        interest:interests(
          *,
          category:interest_categories(*),
          subcategory:interest_subcategories(*)
        )
      `)
      .eq('tour_id', tourId);

    if (error) throw error;
    return { success: true, interests: data || [] };
  } catch (error) {
    console.error('Get tour interests error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set interests for a tour
 */
export async function setTourInterests(tourId, interestIds) {
  try {
    // Remove existing interests
    await supabase.from('tour_interests').delete().eq('tour_id', tourId);

    // Add new interests
    if (interestIds && interestIds.length > 0) {
      const tourInterests = interestIds.map(interestId => ({
        tour_id: tourId,
        interest_id: interestId
      }));

      const { error } = await supabase.from('tour_interests').insert(tourInterests);
      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Set tour interests error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search locations by interest
 */
export async function searchLocationsByInterest(interestId, cityId = null, limit = 10) {
  try {
    let query = supabase
      .from('locations')
      .select(`
        *,
        city:cities(*),
        interests:location_interests(
          interest:interests(*)
        )
      `)
      .eq('location_interests.interest_id', interestId)
      .order('location_interests.relevance_score', { ascending: false })
      .limit(limit);

    if (cityId) {
      query = query.eq('city_id', cityId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, locations: data || [] };
  } catch (error) {
    console.error('Search locations by interest error:', error);
    return { success: false, error: error.message, locations: [] };
  }
}

/**
 * Search tours by interest
 */
export async function searchToursByInterest(interestId, cityId = null, limit = 10) {
  try {
    let query = supabase
      .from('tours')
      .select(`
        *,
        guide:guides(*),
        city:cities(*),
        interests:tour_interests(
          interest:interests(*)
        )
      `)
      .eq('tour_interests.interest_id', interestId)
      .eq('is_published', true)
      .limit(limit);

    if (cityId) {
      query = query.eq('city_id', cityId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, tours: data || [] };
  } catch (error) {
    console.error('Search tours by interest error:', error);
    return { success: false, error: error.message, tours: [] };
  }
}

