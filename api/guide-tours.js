/**
 * Guide Tours API - Get tours for current guide/creator
 * Returns all tours created by the authenticated creator
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

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

    // Get user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get tours created by this user
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select(`
        *,
        city:cities(name, country)
      `)
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (toursError) {
      console.error('Error fetching guide tours:', toursError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tours',
        message: toursError.message
      });
    }

    // Format tours for response
    const formattedTours = (tours || []).map(tour => ({
      id: tour.id,
      title: tour.title,
      description: tour.description,
      country: tour.country,
      city: tour.city?.name || null,
      city_id: tour.city_id,
      daily_plan: tour.daily_plan || [],
      tags: tour.tags || [],
      meta: tour.meta || {},
      verified: tour.verified || false,
      createdAt: tour.created_at,
      updatedAt: tour.updated_at
    }));

    console.log(`✅ Found ${formattedTours.length} tours for creator ${user.id}`);

    return res.status(200).json({
      success: true,
      tours: formattedTours,
      total: formattedTours.length
    });

  } catch (error) {
    console.error('❌ Error in guide-tours:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tours',
      message: error.message
    });
  }
}

