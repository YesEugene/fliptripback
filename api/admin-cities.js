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
    const { data: cities, error } = await supabase
      .from('cities')
      .select(`
        id,
        name,
        country:countries(id, name)
      `)
      .order('name', { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      cities: cities || []
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

