// Cities Service - Database operations for cities
import { supabase } from '../db.js';

/**
 * Get or create a city by name
 * @param {string} cityName - Name of the city
 * @param {string|null} countryName - Name of the country (optional)
 * @returns {Promise<number|null>} City ID or null if error
 */
export async function getOrCreateCity(cityName, countryName = null) {
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, cannot get/create city');
      return null;
    }

    if (!cityName) {
      return null;
    }

    // First, try to find existing city
    const { data: existingCity, error: searchError } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .limit(1)
      .single();

    if (existingCity && !searchError) {
      return existingCity.id;
    }

    // If not found, create new city
    const cityData = {
      name: cityName,
      country: countryName || null
    };

    const { data: newCity, error: insertError } = await supabase
      .from('cities')
      .insert(cityData)
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Error creating city:', insertError);
      return null;
    }

    return newCity.id;
  } catch (error) {
    console.error('❌ Error in getOrCreateCity:', error);
    return null;
  }
}

