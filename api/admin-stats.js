// Admin Stats API - Returns statistics for admin dashboard
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers - allow all origins for now
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Get counts from database
    const [
      { count: toursCount },
      { count: locationsCount },
      { count: creatorsCount },
      { count: usersCount },
      { count: generatedToursCount },
      { count: paymentsCount }
    ] = await Promise.all([
      supabase.from('tours').select('*', { count: 'exact', head: true }),
      supabase.from('locations').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('generated_tours').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true })
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        tours: toursCount || 0,
        locations: locationsCount || 0,
        creators: creatorsCount || 0,
        users: usersCount || 0,
        generatedTours: generatedToursCount || 0,
        payments: paymentsCount || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message,
      stats: {
        tours: 0,
        locations: 0,
        creators: 0,
        users: 0,
        generatedTours: 0,
        payments: 0
      }
    });
  }
}

