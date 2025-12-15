/**
 * Admin Statistics Service
 * Aggregates data for admin dashboard
 */

import { supabase } from '../db.js';
import { Redis } from '@upstash/redis';

// Get Redis client for stats
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    return null; // Redis not available, but don't fail
  }
  
  return new Redis({ url, token });
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats() {
  try {
    // Get counts
    const [
      usersCount,
      guidesCount,
      toursCount,
      locationsCount,
      itinerariesCount,
      paymentsCount
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'guide'),
      supabase.from('tours').select('id', { count: 'exact', head: true }),
      supabase.from('locations').select('id', { count: 'exact', head: true }),
      supabase.from('itineraries').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('id', { count: 'exact', head: true })
    ]);

    // Get plan generations count from Redis
    let planGenerations = 0;
    try {
      const redis = getRedis();
      if (redis) {
        const count = await redis.get('stats:plan_generations');
        planGenerations = parseInt(count) || 0;
      }
    } catch (redisError) {
      console.warn('⚠️ Failed to get plan generations from Redis:', redisError.message);
      // Continue without Redis count
    }

    // Get revenue stats
    const { data: revenueData, error: revenueError } = await supabase
      .from('payments')
      .select('amount, status, created_at')
      .eq('status', 'completed');

    if (revenueError) throw revenueError;

    const totalRevenue = revenueData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Get recent activity
    const { data: recentTours } = await supabase
      .from('tours')
      .select('id, title, created_at, guide:guides(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: recentPayments } = await supabase
      .from('payments')
      .select('id, amount, status, created_at, user:users(email)')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get tours by status
    const { data: toursByStatus } = await supabase
      .from('tours')
      .select('status')
      .then(result => {
        const statuses = {};
        result.data?.forEach(tour => {
          statuses[tour.status] = (statuses[tour.status] || 0) + 1;
        });
        return { data: statuses };
      });

    // Get locations by verification status
    const { data: locationsByVerified } = await supabase
      .from('locations')
      .select('verified')
      .then(result => {
        const verified = { verified: 0, unverified: 0 };
        result.data?.forEach(loc => {
          if (loc.verified) verified.verified++;
          else verified.unverified++;
        });
        return { data: verified };
      });

    return {
      success: true,
      stats: {
        counts: {
          users: usersCount.count || 0,
          guides: guidesCount.count || 0,
          tours: toursCount.count || 0,
          locations: locationsCount.count || 0,
          itineraries: itinerariesCount.count || 0,
          payments: paymentsCount.count || 0,
          planGenerations: planGenerations
        },
        revenue: {
          total: totalRevenue,
          completed: revenueData?.length || 0
        },
        toursByStatus: toursByStatus.data || {},
        locationsByVerified: locationsByVerified.data || {},
        recentTours: recentTours?.data || [],
        recentPayments: recentPayments?.data || []
      }
    };
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get statistics over time (for charts)
 */
export async function getStatsOverTime(period = '30days') {
  try {
    const days = period === '30days' ? 30 : period === '7days' ? 7 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get tours created over time
    const { data: toursOverTime } = await supabase
      .from('tours')
      .select('created_at')
      .gte('created_at', startDate.toISOString());

    // Get payments over time
    const { data: paymentsOverTime } = await supabase
      .from('payments')
      .select('amount, created_at, status')
      .gte('created_at', startDate.toISOString())
      .eq('status', 'completed');

    // Get itineraries over time
    const { data: itinerariesOverTime } = await supabase
      .from('itineraries')
      .select('created_at')
      .gte('created_at', startDate.toISOString());

    return {
      success: true,
      data: {
        tours: toursOverTime?.data || [],
        payments: paymentsOverTime?.data || [],
        itineraries: itinerariesOverTime?.data || []
      }
    };
  } catch (error) {
    console.error('Get stats over time error:', error);
    return { success: false, error: error.message };
  }
}

