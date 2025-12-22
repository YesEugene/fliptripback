// Check Payment API - Check if user has paid for a tour
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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

    const { tourId, email } = req.query;

    if (!tourId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: tourId and email'
      });
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !user) {
      // User doesn't exist, so no payment
      return res.status(200).json({
        success: true,
        hasPaid: false,
        booking: null
      });
    }

    // Check if there's a paid booking for this tour and user
    const { data: booking, error: bookingError } = await supabase
      .from('tour_bookings')
      .select('id, tour_id, user_id, payment_status, status, created_at')
      .eq('tour_id', tourId)
      .eq('user_id', user.id)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (bookingError) {
      // No booking found or error - treat as not paid
      if (bookingError.code === 'PGRST116') {
        // No rows returned - this is expected if no booking exists
        return res.status(200).json({
          success: true,
          hasPaid: false,
          booking: null
        });
      }
      
      console.error('Error checking payment:', bookingError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check payment status',
        message: bookingError.message
      });
    }

    // Booking found and paid
    return res.status(200).json({
      success: true,
      hasPaid: true,
      booking: {
        id: booking.id,
        tour_id: booking.tour_id,
        user_id: booking.user_id,
        payment_status: booking.payment_status,
        status: booking.status,
        created_at: booking.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error checking payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check payment status',
      message: error.message
    });
  }
}

