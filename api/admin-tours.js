/**
 * Admin Tours Endpoint
 * View and manage all tours
 */

import { getTours, getTourById, deleteTour } from '../database/services/toursService.js';

// Extract user ID from Authorization header
function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId || payload.id || null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // TODO: Add admin authentication check
    const adminUserId = getUserId(req);

    if (req.method === 'GET') {
      const { id, ...filters } = req.query;

      if (id) {
        const result = await getTourById(id);
        return res.status(result.success ? 200 : 404).json(result);
      }

      const result = await getTours(filters);
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, message: 'Tour ID required' });
      }

      // Admin can delete any tour
      const result = await deleteTour(id, adminUserId);
      return res.status(result.success ? 200 : 400).json(result);
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Admin tours error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
}

