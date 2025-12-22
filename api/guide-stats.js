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
        tour:tours(id, title, city_id, default_format, cities(name)),
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

    // Helper function to safely parse additional_services (may be string or object)
    const parseAdditionalServices = (additionalServices) => {
      if (!additionalServices) return null;
      if (typeof additionalServices === 'object') return additionalServices;
      if (typeof additionalServices === 'string') {
        try {
          return JSON.parse(additionalServices);
        } catch (e) {
          console.warn('⚠️ Failed to parse additional_services as JSON:', e);
          return null;
        }
      }
      return null;
    };

    // Separate guided and self-guided bookings
    // Use additional_services.tour_type if available, otherwise use tour.default_format
    const guidedBookings = allBookings.filter(b => {
      const additionalServices = parseAdditionalServices(b.additional_services);
      // Check additional_services first (from webhook)
      if (additionalServices) {
        if (additionalServices.tour_type === 'guided' || additionalServices.purchased_as === 'with-guide') {
          return true;
        }
        if (additionalServices.tour_type === 'self-guided' || additionalServices.purchased_as === 'self-guided') {
          return false;
        }
      }
      // Fallback to tour.default_format
      const tourFormat = b.tour?.default_format;
      return tourFormat === 'with_guide' || tourFormat === 'guided';
    });
    
    const selfGuidedBookings = allBookings.filter(b => {
      const additionalServices = parseAdditionalServices(b.additional_services);
      // Check additional_services first (from webhook)
      if (additionalServices) {
        if (additionalServices.tour_type === 'self-guided' || additionalServices.purchased_as === 'self-guided') {
          return true;
        }
        if (additionalServices.tour_type === 'guided' || additionalServices.purchased_as === 'with-guide') {
          return false;
        }
      }
      // Fallback to tour.default_format
      const tourFormat = b.tour?.default_format;
      return tourFormat === 'self_guided' || tourFormat === 'self-guided' || !tourFormat;
    });

    // Debug logging
    console.log('📊 Booking statistics:');
    console.log('  - Total bookings:', allBookings.length);
    console.log('  - Guided bookings:', guidedBookings.length);
    console.log('  - Self-guided bookings:', selfGuidedBookings.length);
    if (allBookings.length > 0) {
      console.log('  - Sample booking additional_services:', JSON.stringify(allBookings[0].additional_services));
      console.log('  - Sample booking tour.default_format:', allBookings[0].tour?.default_format);
    }

    // Calculate confirmed by type
    const confirmedGuided = guidedBookings.filter(b => b.status === 'confirmed').length;
    const confirmedSelfGuided = selfGuidedBookings.filter(b => b.status === 'confirmed').length;

    // Calculate revenue (only from paid bookings)
    const paidBookings = allBookings.filter(b => b.payment_status === 'paid');
    const totalRevenue = paidBookings.reduce((sum, booking) => {
      return sum + parseFloat(booking.total_price || 0);
    }, 0);

    // Calculate revenue by type
    // Use the same logic as booking filtering: check additional_services first, then tour.default_format
    const guidedRevenue = paidBookings
      .filter(b => {
        const additionalServices = parseAdditionalServices(b.additional_services);
        // Check additional_services first (from webhook)
        if (additionalServices) {
          if (additionalServices.tour_type === 'guided' || additionalServices.purchased_as === 'with-guide') {
            return true;
          }
          if (additionalServices.tour_type === 'self-guided' || additionalServices.purchased_as === 'self-guided') {
            return false;
          }
        }
        // Fallback to tour.default_format
        const tourFormat = b.tour?.default_format;
        return tourFormat === 'with_guide' || tourFormat === 'guided';
      })
      .reduce((sum, booking) => sum + parseFloat(booking.total_price || 0), 0);
    
    const selfGuidedRevenue = paidBookings
      .filter(b => {
        const additionalServices = parseAdditionalServices(b.additional_services);
        // Check additional_services first (from webhook)
        if (additionalServices) {
          if (additionalServices.tour_type === 'self-guided' || additionalServices.purchased_as === 'self-guided') {
            return true;
          }
          if (additionalServices.tour_type === 'guided' || additionalServices.purchased_as === 'with-guide') {
            return false;
          }
        }
        // Fallback to tour.default_format
        const tourFormat = b.tour?.default_format;
        return tourFormat === 'self_guided' || tourFormat === 'self-guided' || !tourFormat;
      })
      .reduce((sum, booking) => sum + parseFloat(booking.total_price || 0), 0);

    console.log('💰 Revenue statistics:');
    console.log('  - Total revenue:', totalRevenue);
    console.log('  - Guided revenue:', guidedRevenue);
    console.log('  - Self-guided revenue:', selfGuidedRevenue);

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
    const recentBookings = allBookings.slice(0, 10).map(booking => {
      // Determine tour type: first check additional_services (from webhook), then tour.default_format
      let tourType = 'self-guided';
      
      const additionalServices = parseAdditionalServices(booking.additional_services);
      if (additionalServices) {
        // Check if tour_type is stored in additional_services
        if (additionalServices.tour_type) {
          tourType = additionalServices.tour_type;
        } else if (additionalServices.purchased_as) {
          tourType = additionalServices.purchased_as === 'with-guide' ? 'guided' : 'self-guided';
        }
      }
      
      // Fallback: use tour.default_format if not in additional_services
      if (tourType === 'self-guided') {
        const tourFormat = booking.tour?.default_format;
        if (tourFormat === 'with_guide' || tourFormat === 'guided') {
          tourType = 'guided';
        }
      }
      
      return {
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
        tour_type: tourType,
        created_at: booking.created_at
      };
    });

    // Get booking notifications (type = 'booking')
    const bookingNotifications = (notifications || []).filter(n => n.type === 'booking');

    return res.status(200).json({
      success: true,
      stats: {
        bookings: {
          total: allBookings.length,
          guided: guidedBookings.length,
          selfGuided: selfGuidedBookings.length,
          confirmed: confirmedBookings.length,
          confirmedGuided: confirmedGuided,
          confirmedSelfGuided: confirmedSelfGuided,
          pending: pendingBookings.length,
          cancelled: cancelledBookings.length,
          completed: completedBookings.length
        },
        revenue: {
          total: totalRevenue,
          guided: guidedRevenue,
          selfGuided: selfGuidedRevenue,
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

