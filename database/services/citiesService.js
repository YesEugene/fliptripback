// Cities Service - Database operations for cities
import { supabase } from '../db.js';

/**
 * Get city by name (NO LONGER CREATES NEW CITIES)
 * Cities must be imported from worldcities.csv
 * @param {string} cityName - Name of the city
 * @param {string|null} countryName - Name of the country (optional, for better matching)
 * @returns {Promise<string|null>} City ID (UUID) or null if not found
 */
export async function getOrCreateCity(cityName, countryName = null) {
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, cannot get city');
      return null;
    }

    if (!cityName) {
      return null;
    }

    // Search for existing city by name (case-insensitive)
    let query = supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .limit(1);

    // If country is provided, try to match by both name and country for better accuracy
    if (countryName) {
      query = query.ilike('country', countryName);
    }

    const { data: existingCity, error: searchError } = await query.maybeSingle();

    if (existingCity && !searchError) {
      return existingCity.id;
    }

    // City not found - DO NOT CREATE NEW CITY
    // All cities must be imported from worldcities.csv
    console.warn(`⚠️ City not found: ${cityName}${countryName ? `, ${countryName}` : ''}. Cities must be imported from worldcities.csv`);
    return null;
  } catch (error) {
    console.error('❌ Error in getOrCreateCity:', error);
    return null;
  }
}

/**
 * Get cities that have tours or locations (for filter display)
 * @param {boolean} onlyWithContent - If true, return only cities with tours or locations
 * @returns {Promise<Array>} Array of cities with id, name, country
 */
export async function getCities(onlyWithContent = false) {
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, cannot get cities');
      return [];
    }

    if (onlyWithContent) {
      // Get cities that have tours OR locations
      // Using DISTINCT to avoid duplicates
      const { data: citiesWithTours, error: toursError } = await supabase
        .from('tours')
        .select('city_id, city:cities(id, name, country)')
        .not('city_id', 'is', null);

      const { data: citiesWithLocations, error: locationsError } = await supabase
        .from('locations')
        .select('city_id, city:cities(id, name, country)')
        .not('city_id', 'is', null);

      if (toursError || locationsError) {
        console.error('❌ Error fetching cities with content:', toursError || locationsError);
        return [];
      }

      // Combine and deduplicate
      const cityMap = new Map();
      
      // Add cities from tours
      if (citiesWithTours) {
        citiesWithTours.forEach(item => {
          if (item.city && item.city.id) {
            cityMap.set(item.city.id, {
              id: item.city.id,
              name: item.city.name,
              country: item.city.country
            });
          }
        });
      }

      // Add cities from locations
      if (citiesWithLocations) {
        citiesWithLocations.forEach(item => {
          if (item.city && item.city.id) {
            cityMap.set(item.city.id, {
              id: item.city.id,
              name: item.city.name,
              country: item.city.country
            });
          }
        });
      }

      return Array.from(cityMap.values()).sort((a, b) => {
        // Sort by name
        return a.name.localeCompare(b.name);
      });
    } else {
      // Get all cities
      const { data: cities, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ Error fetching cities:', error);
        return [];
      }

      return cities || [];
    }
  } catch (error) {
    console.error('❌ Error in getCities:', error);
    return [];
  }
}

