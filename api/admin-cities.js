/**
 * Admin Cities Endpoint
 * GET /api/admin-cities - Get list of cities for dropdowns
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    // Get all cities - simplified query (check if country column exists)
    const { data: cities, error } = await supabase
      .from('cities')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching cities:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching cities',
        error: error.message
      });
    }

    // Format cities for frontend
    const formattedCities = (cities || []).map(city => ({
      id: city.id,
      name: city.name,
      country: null // Country field doesn't exist in cities table
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

