/**
 * Admin Cities Endpoint
 * GET /api/admin-cities - Get list of cities for dropdowns
 * 
 * Query parameters:
 * - onlyWithContent: if true, return only cities that have tours or locations
 * - search: search query for autocomplete (returns matching cities)
 */

import { getCities } from '../database/services/citiesService.js';
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'https://fliptrip-clean-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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

    const { onlyWithContent, search } = req.query;
    const onlyWithContentFlag = onlyWithContent === 'true' || onlyWithContent === true;

    // If search query provided, return matching cities for autocomplete
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      
      // Minimum search length is 2 characters
      if (searchTerm.length < 2) {
        return res.status(200).json({
          success: true,
          cities: []
        });
      }
      
      // Escape special characters in search term for Supabase
      const escapedSearchTerm = searchTerm.replace(/[%_\\]/g, '\\$&');
      
      let query = supabase
        .from('cities')
        .select('id, name, country')
        .or(`name.ilike.%${escapedSearchTerm}%,country.ilike.%${escapedSearchTerm}%`)
        .limit(50) // Limit results for autocomplete
        .order('name', { ascending: true });

      const { data: cities, error } = await query;

      if (error) {
        console.error('Error searching cities:', error);
        return res.status(500).json({
          success: false,
          message: 'Error searching cities',
          error: error.message
        });
      }

      // Format cities for frontend and deduplicate by name+country combination
      const cityMap = new Map();
      (cities || []).forEach(city => {
        const key = `${city.name.toLowerCase()}_${(city.country || '').toLowerCase()}`;
        if (!cityMap.has(key)) {
          cityMap.set(key, {
            id: city.id,
            name: city.name,
            country: city.country || null,
            displayName: city.country ? `${city.name}, ${city.country}` : city.name
          });
        }
      });

      const formattedCities = Array.from(cityMap.values());

      return res.status(200).json({
        success: true,
        cities: formattedCities
      });
    }

    // Get cities (with or without content filter)
    const cities = await getCities(onlyWithContentFlag);

    // Format cities for frontend
    const formattedCities = cities.map(city => ({
      id: city.id,
      name: city.name,
      country: city.country || null,
      displayName: city.country ? `${city.name}, ${city.country}` : city.name
    }));

    return res.status(200).json({
      success: true,
      cities: formattedCities
    });
  } catch (error) {
    console.error('Admin cities error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching cities',
      error: error.message
    });
  }
}

