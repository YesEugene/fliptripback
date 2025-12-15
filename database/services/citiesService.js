/**
 * Cities Service - Helper functions for cities and countries
 */

import { supabase } from '../db.js';

/**
 * Get or create country by name
 */
export async function getOrCreateCountry(countryName) {
  if (!countryName) return null;

  try {
    // Try to find existing country
    let { data: country } = await supabase
      .from('countries')
      .select('id')
      .eq('name', countryName)
      .single();

    if (!country) {
      // Create new country
      const { data: newCountry, error } = await supabase
        .from('countries')
        .insert({ name: countryName })
        .select()
        .single();

      if (error) throw error;
      return newCountry.id;
    }

    return country.id;
  } catch (error) {
    console.error('Get or create country error:', error);
    return null;
  }
}

/**
 * Get or create city by name and country
 */
export async function getOrCreateCity(cityName, countryId) {
  if (!cityName) return null;

  try {
    // Try to find existing city (case-insensitive)
    let query = supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName); // Case-insensitive search

    if (countryId) {
      query = query.eq('country_id', countryId);
    }

    const { data: cities } = await query.limit(1);
    const city = cities?.[0];

    if (!city) {
      // Create new city
      const { data: newCity, error } = await supabase
        .from('cities')
        .insert({ 
          name: cityName,
          country_id: countryId || null
        })
        .select()
        .single();

      if (error) throw error;
      return newCity.id;
    }

    return city.id;
  } catch (error) {
    console.error('Get or create city error:', error);
    return null;
  }
}

