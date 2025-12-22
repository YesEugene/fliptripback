/**
 * Guide Statistics API
 * Returns statistics for a guide: bookings, revenue, notifications
 */

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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
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
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    let userId = null;
    try {
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      try {
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || null;
      } catch (e) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(cleanToken);
        if (user) userId = user.id;
      }
    } catch (err) {
      console.error('Auth error:', err);
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Get all bookings for this guide
    const { data: bookings, error: bookingsError } = await supabase
      .from('tour_bookings')
      .select(`
        *,
        tour:tours(id, title, city_id, cities(name)),
        customer:users!tour_bookings_user_id_fkey(id, name, email)
      `)
      .eq('guide_id', userId)
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch bookings'
      });
    }

    // Get notifications for this guide
    console.log('📬 Fetching notifications for guide:', userId);
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (notificationsError) {
      console.error('❌ Error fetching notifications:', notificationsError);
    } else {
      console.log('✅ Found notifications:', notifications?.length || 0);
    }

    // Get unread notifications count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    // Calculate statistics
    const allBookings = bookings || [];
    const confirmedBookings = allBookings.filter(b => b.status === 'confirmed');
    const cancelledBookings = allBookings.filter(b => b.status === 'cancelled');
    const pendingBookings = allBookings.filter(b => b.status === 'pending');
    const completedBookings = allBookings.filter(b => b.status === 'completed');

    // Calculate revenue (only from paid bookings)
    const paidBookings = allBookings.filter(b => b.payment_status === 'paid');
    const totalRevenue = paidBookings.reduce((sum, booking) => {
      return sum + parseFloat(booking.total_price || 0);
    }, 0);

    // Calculate revenue by currency
    const revenueByCurrency = {};
    paidBookings.forEach(booking => {
      const currency = booking.currency || 'USD';
      if (!revenueByCurrency[currency]) {
        revenueByCurrency[currency] = 0;
      }
      revenueByCurrency[currency] += parseFloat(booking.total_price || 0);
    });

    // Get recent bookings (last 10)
    const recentBookings = allBookings.slice(0, 10).map(booking => ({
      id: booking.id,
      tour_title: booking.tour?.title || 'Unknown Tour',
      customer_name: booking.customer?.name || booking.customer?.email || 'Unknown',
      customer_email: booking.customer?.email || null,
      tour_date: booking.tour_date,
      group_size: booking.group_size,
      total_price: booking.total_price,
      currency: booking.currency,
      status: booking.status,
      payment_status: booking.payment_status,
      created_at: booking.created_at
    }));

    // Get booking notifications (type = 'booking')
    const bookingNotifications = (notifications || []).filter(n => n.type === 'booking');

    return res.status(200).json({
      success: true,
      stats: {
        bookings: {
          total: allBookings.length,
          confirmed: confirmedBookings.length,
          pending: pendingBookings.length,
          cancelled: cancelledBookings.length,
          completed: completedBookings.length
        },
        revenue: {
          total: totalRevenue,
          byCurrency: revenueByCurrency
        },
        notifications: {
          total: (notifications || []).length,
          unread: unreadCount || 0,
          booking: bookingNotifications.length
        }
      },
      recentBookings: recentBookings,
      recentNotifications: notifications || []
    });

  } catch (error) {
    console.error('Error in guide-stats API:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
}

