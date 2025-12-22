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

    // Get additional stats
    const { count: verifiedLocationsCount } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('verified', true);
    
    const { count: unverifiedLocationsCount } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('verified', false);

    // Get tours by status
    const { data: allTours } = await supabase
      .from('tours')
      .select('verified');
    
    const toursByStatus = {
      verified: 0,
      unverified: 0
    };
    if (allTours) {
      allTours.forEach(tour => {
        if (tour.verified) {
          toursByStatus.verified++;
        } else {
          toursByStatus.unverified++;
        }
      });
    }

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

    return res.status(200).json({
      success: true,
      stats: {
        counts: {
          users: usersCount || 0,
          guides: creatorsCount || 0, // creators = guides
          tours: toursCount || 0,
          locations: locationsCount || 0,
          itineraries: generatedToursCount || 0,
          planGenerations: generatedToursCount || 0
        },
        revenue: {
          total: totalRevenue,
          pdf: totalPDFRevenue,
          guided: totalGuidedRevenue
        },
        sales: {
          pdf: totalPDFSales,
          guided: totalGuidedSales
        },
        toursByStatus: toursByStatus,
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

