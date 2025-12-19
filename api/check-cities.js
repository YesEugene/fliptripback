/**
 * Check Cities Endpoint
 * GET /api/check-cities - Get all cities from database for debugging
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    // Get all cities
    const { data: cities, error } = await supabase
      .from('cities')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching cities:', error);
      return res.status(500).json({
        success: false,
        error: 'Error fetching cities',
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      count: cities?.length || 0,
      cities: cities || []
    });
  } catch (error) {
    console.error('Check cities error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking cities',
      error: error.message
    });
  }
}


