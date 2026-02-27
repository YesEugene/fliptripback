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
      { count: creatorsCount },
      { count: usersCount },
      { count: generatedToursCount },
      { count: paymentsCount }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('generated_tours').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true })
    ]);

    // Get tours and compute status exactly like admin tours logic
    // Use select('*') to avoid breakage if legacy columns differ between environments.
    const { data: allTours, error: allToursError } = await supabase
      .from('tours')
      .select('*');

    if (allToursError) {
      throw new Error(`Failed to load tours for stats: ${allToursError.message}`);
    }

    const hasTourFormat = (tour) => {
      if (tour?.default_format === 'self_guided' || tour?.default_format === 'with_guide') return true;
      const settings = tour?.draft_data?.tourSettings;
      return settings?.selfGuided === true || settings?.withGuide === true;
    };

    const normalizeTourStatus = (tour) => {
      const raw = (tour?.status || '').toString().toLowerCase();
      if (raw === 'approved' || raw === 'pending' || raw === 'draft' || raw === 'rejected') return raw;
      if (raw === 'published' || raw === 'active') return 'approved';
      if (tour?.is_published) return 'approved';
      return 'draft';
    };

    const toursForAdmin = (allTours || []).filter((tour) => {
      const isAiTour = tour?.source === 'user_generated';
      if (isAiTour) return false;
      // Match admin experience: keep all non-draft moderation statuses even for legacy tours.
      const normalizedStatus = normalizeTourStatus(tour);
      if (normalizedStatus !== 'draft') return true;
      return hasTourFormat(tour);
    });
    
    const toursByStatus = {
      verified: 0,
      unverified: 0,
      approved: 0,
      pending: 0,
      draft: 0,
      rejected: 0
    };
    if (toursForAdmin.length > 0) {
      toursForAdmin.forEach(tour => {
        // Legacy: verified/unverified
        if (tour.verified) {
          toursByStatus.verified++;
        } else {
          toursByStatus.unverified++;
        }
        // New: status-based with fallback for legacy rows
        const status = normalizeTourStatus(tour);
        if (toursByStatus.hasOwnProperty(status)) {
          toursByStatus[status]++;
        }
      });
    }

    const toursCount = toursForAdmin.length;

    // Match admin-locations visibility and keep only locations used in tours
    // (linked tour_items OR referenced in visualizer location blocks).
    const { data: dashboardLocations } = await supabase
      .from('locations')
      .select('id, name, address, verified, source');

    const normalize = (value) => (value || '').toString().trim().toLowerCase();
    const usedLocationIds = new Set();
    const usedContentKeys = new Set();

    const [{ data: linkedTourItems }, { data: locationBlocks }] = await Promise.all([
      supabase
        .from('tour_items')
        .select('location_id')
        .not('location_id', 'is', null),
      supabase
        .from('tour_content_blocks')
        .select('content')
        .eq('block_type', 'location')
        .limit(10000)
    ]);

    (linkedTourItems || []).forEach(item => {
      if (item.location_id) usedLocationIds.add(item.location_id);
    });

    const addLocationKey = (loc) => {
      if (!loc || typeof loc !== 'object') return;
      const name = normalize(loc.title || loc.name);
      if (!name) return;
      const address = normalize(loc.address);
      usedContentKeys.add(`${name}|${address}`);
      usedContentKeys.add(`${name}|`);
    };

    (locationBlocks || []).forEach(block => {
      const content = block?.content || {};
      addLocationKey(content.mainLocation || content);
      if (Array.isArray(content.alternativeLocations)) {
        content.alternativeLocations.forEach(addLocationKey);
      }
    });

    const locationsForAdmin = (dashboardLocations || []).filter((loc) => {
      const visibleBySource = loc?.verified === true || loc?.source === 'admin' || loc?.source === 'guide';
      if (!visibleBySource) return false;

      if (usedLocationIds.has(loc.id)) return true;
      const name = normalize(loc.name);
      if (!name) return false;
      const address = normalize(loc.address);
      return usedContentKeys.has(`${name}|${address}`) || usedContentKeys.has(`${name}|`);
    });
    const locationsCount = locationsForAdmin.length;
    const verifiedLocationsCount = locationsForAdmin.filter((loc) => loc?.verified === true).length;
    const unverifiedLocationsCount = locationsForAdmin.filter((loc) => loc?.verified !== true).length;
    
    // Get users breakdown (guides, customers, admins)
    const { data: allUsers } = await supabase
      .from('users')
      .select('role');
    
    const usersBreakdown = {
      guides: 0,
      customers: 0,
      admins: 0
    };
    if (allUsers) {
      allUsers.forEach(user => {
        const role = user.role || 'user';
        if (role === 'creator' || role === 'guide') {
          usersBreakdown.guides++;
        } else if (role === 'admin') {
          usersBreakdown.admins++;
        } else {
          usersBreakdown.customers++;
        }
      });
    }
    
    // Get bookings statistics by status
    const { data: allBookingsForStatus } = await supabase
      .from('tour_bookings')
      .select('status, payment_status, created_at');
    
    const bookingsByStatus = {
      total: 0,
      confirmed: 0,
      pending: 0,
      completed: 0,
      cancelled: 0
    };
    
    // Time-based metrics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let bookingsToday = 0;
    let bookingsThisWeek = 0;
    let bookingsThisMonth = 0;
    
    if (allBookingsForStatus) {
      allBookingsForStatus.forEach(booking => {
        bookingsByStatus.total++;
        const status = booking.status || 'pending';
        if (bookingsByStatus.hasOwnProperty(status)) {
          bookingsByStatus[status]++;
        }
        
        // Time-based counts
        const bookingDate = new Date(booking.created_at);
        if (bookingDate >= todayStart) bookingsToday++;
        if (bookingDate >= weekStart) bookingsThisWeek++;
        if (bookingDate >= monthStart) bookingsThisMonth++;
      });
    }
    
    // Calculate revenue this month from paid bookings
    const { data: paidBookingsThisMonth } = await supabase
      .from('tour_bookings')
      .select('total_price')
      .eq('payment_status', 'paid')
      .gte('created_at', monthStart.toISOString());
    
    let revenueThisMonth = 0;
    if (paidBookingsThisMonth) {
      revenueThisMonth = paidBookingsThisMonth.reduce((sum, booking) => {
        return sum + parseFloat(booking.total_price || 0);
      }, 0);
    }
    
    // Get notifications and messages statistics
    const { count: totalNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    const { count: unreadNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('created_at')
      .gte('created_at', weekStart.toISOString());
    
    const messagesThisWeek = recentMessages?.length || 0;
    
    // Get active conversations (unique booking_ids with messages)
    const { data: activeConversations } = await supabase
      .from('messages')
      .select('booking_id')
      .gte('created_at', weekStart.toISOString());
    
    const uniqueBookings = new Set();
    if (activeConversations) {
      activeConversations.forEach(msg => {
        if (msg.booking_id) uniqueBookings.add(msg.booking_id);
      });
    }
    
    // Get new users this week
    const { count: newUsersThisWeek } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());

    // Get bookings statistics (PDF and Guided sales)
    const { data: allBookings } = await supabase
      .from('tour_bookings')
      .select(`
        *,
        tour:tours(id, default_format)
      `)
      .eq('payment_status', 'paid');

    // Helper function to safely parse additional_services
    const parseAdditionalServices = (additionalServices) => {
      if (!additionalServices) return null;
      if (typeof additionalServices === 'object') return additionalServices;
      if (typeof additionalServices === 'string') {
        try {
          return JSON.parse(additionalServices);
        } catch (e) {
          return null;
        }
      }
      return null;
    };

    // Calculate sales statistics
    let totalPDFSales = 0;
    let totalGuidedSales = 0;
    let totalPDFRevenue = 0;
    let totalGuidedRevenue = 0;

    if (allBookings) {
      allBookings.forEach(booking => {
        const additionalServices = parseAdditionalServices(booking.additional_services);
        let isGuided = false;
        let isSelfGuided = false;

        // Check additional_services first (from webhook)
        if (additionalServices) {
          if (additionalServices.tour_type === 'guided' || additionalServices.purchased_as === 'with-guide') {
            isGuided = true;
          } else if (additionalServices.tour_type === 'self-guided' || additionalServices.purchased_as === 'self-guided') {
            isSelfGuided = true;
          }
        }

        // Fallback to tour.default_format
        if (!isGuided && !isSelfGuided) {
          const tourFormat = booking.tour?.default_format;
          if (tourFormat === 'with_guide' || tourFormat === 'guided') {
            isGuided = true;
          } else {
            isSelfGuided = true;
          }
        }

        const price = parseFloat(booking.total_price || 0);

        if (isGuided) {
          totalGuidedSales++;
          totalGuidedRevenue += price;
        } else if (isSelfGuided) {
          totalPDFSales++;
          totalPDFRevenue += price;
        }
      });
    }

    const totalRevenue = totalPDFRevenue + totalGuidedRevenue;

    // Calculate Funnel metrics
    // Note: Visitors and Tour preview are approximate until analytics table is implemented
    // For now:
    // - Visitors: approximate as unique users who generated tours (can be improved with analytics)
    // - Tour preview: all generated_tours (as they are generated when viewing preview)
    // - Itineraries generated: count from generated_tours table
    // - Full tour opened: confirmed bookings (paid tours)
    
    // Get unique users who generated tours (approximate visitors)
    const { data: uniqueUsersGenerated } = await supabase
      .from('generated_tours')
      .select('user_id')
      .not('user_id', 'is', null);
    
    const uniqueVisitorCount = uniqueUsersGenerated 
      ? new Set(uniqueUsersGenerated.map(t => t.user_id)).size 
      : 0;
    
    // Tour preview = all generated_tours (they are created when user views preview)
    const tourPreviewCount = generatedToursCount || 0;
    
    // Itineraries generated = same as tour preview for now
    const itinerariesGeneratedCount = generatedToursCount || 0;
    
    // Full tour opened = confirmed/paid bookings
    const fullTourOpenedCount = bookingsByStatus.confirmed || 0;

    return res.status(200).json({
      success: true,
      stats: {
        counts: {
          users: usersCount || 0,
          guides: creatorsCount || 0, // creators = guides
          tours: toursCount,
          locations: locationsCount || 0,
          itineraries: generatedToursCount || 0,
          planGenerations: generatedToursCount || 0
        },
        users: {
          total: usersCount || 0,
          guides: usersBreakdown.guides,
          customers: usersBreakdown.customers,
          admins: usersBreakdown.admins
        },
        revenue: {
          total: totalRevenue,
          pdf: totalPDFRevenue,
          guided: totalGuidedRevenue,
          thisMonth: revenueThisMonth
        },
        sales: {
          pdf: totalPDFSales,
          guided: totalGuidedSales
        },
        tours: {
          total: toursCount,
          verified: toursByStatus.verified,
          approved: toursByStatus.approved,
          pending: toursByStatus.pending,
          draft: toursByStatus.draft,
          rejected: toursByStatus.rejected
        },
        bookings: {
          total: bookingsByStatus.total,
          confirmed: bookingsByStatus.confirmed,
          pending: bookingsByStatus.pending,
          completed: bookingsByStatus.completed,
          cancelled: bookingsByStatus.cancelled,
          today: bookingsToday,
          thisWeek: bookingsThisWeek,
          thisMonth: bookingsThisMonth
        },
        funnel: {
          visitors: uniqueVisitorCount,
          tourPreview: tourPreviewCount,
          itinerariesGenerated: itinerariesGeneratedCount,
          fullTourOpened: fullTourOpenedCount
        },
        activity: {
          newBookingsToday: bookingsToday,
          newUsersThisWeek: newUsersThisWeek || 0,
          revenueThisMonth: revenueThisMonth,
          unreadNotifications: unreadNotifications || 0,
          totalNotifications: totalNotifications || 0,
          messagesThisWeek: messagesThisWeek,
          activeConversations: uniqueBookings.size
        },
        toursByStatus: toursByStatus, // Legacy support
        locationsByVerified: {
          verified: verifiedLocationsCount || 0,
          unverified: unverifiedLocationsCount || 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message,
      stats: {
        counts: {
          users: 0,
          guides: 0,
          tours: 0,
          locations: 0,
          itineraries: 0,
          planGenerations: 0
        },
        revenue: {
          total: 0,
          pdf: 0,
          guided: 0
        },
        sales: {
          pdf: 0,
          guided: 0
        },
        toursByStatus: {
          verified: 0,
          unverified: 0
        },
        locationsByVerified: {
          verified: 0,
          unverified: 0
        }
      }
    });
  }
}

