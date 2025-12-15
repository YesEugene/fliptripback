/**
 * Admin Statistics Endpoint
 * GET /api/admin-stats - Get dashboard statistics
 */

import { getDashboardStats, getStatsOverTime } from '../database/services/adminStatsService.js';

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
    // TODO: Add admin authentication check
    // const userId = getUserId(req);
    // if (!userId || user.role !== 'admin') {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }

    const { period } = req.query;

    if (period) {
      const result = await getStatsOverTime(period);
      return res.status(200).json(result);
    }

    const result = await getDashboardStats();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
}

