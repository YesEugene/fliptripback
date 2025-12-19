/**
 * Admin Moderate Tours API
 * Endpoint for moderating tours (approve/reject)
 */

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    // Extract user ID from token
    let userId = null;
    try {
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      console.log('🔐 Token received, length:', cleanToken.length);
      
      // Try to decode as base64 JSON first
      try {
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || payload.sub;
        console.log('✅ Token decoded as base64 JSON, userId:', userId);
      } catch (e) {
        // If base64 decode fails, try Supabase auth
        console.log('⚠️ Base64 decode failed, trying Supabase auth...');
        const { data: { user }, error: authError } = await supabase.auth.getUser(cleanToken);
        if (!authError && user) {
          userId = user.id;
          console.log('✅ User found via Supabase auth, userId:', userId);
        } else {
          console.error('❌ Supabase auth error:', authError);
          // Try to use token as userId directly (if it's a UUID)
          if (cleanToken.length === 36 && cleanToken.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            userId = cleanToken;
            console.log('✅ Using token as userId (UUID format)');
          }
        }
      }
    } catch (error) {
      console.error('❌ Token decode error:', error);
    }

    if (!userId) {
      console.error('❌ No userId extracted from token');
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Could not extract user ID from token'
      });
    }

    // Validate userId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('❌ Invalid userId format (not UUID):', userId);
      return res.status(401).json({
        success: false,
        error: 'Invalid user ID format',
        message: `User ID must be a valid UUID, got: ${userId}`
      });
    }

    console.log('🔍 Checking admin role for userId:', userId);

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, email')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: userError.message
      });
    }

    if (!userData) {
      console.error('❌ User not found in database, userId:', userId);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: User not found',
        message: `User with ID ${userId} not found in database`
      });
    }

    console.log('👤 User found:', { id: userData.id, email: userData.email, role: userData.role });

    if (userData.role !== 'admin') {
      console.error('❌ User is not admin, role:', userData.role);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required',
        message: `User role is "${userData.role}", but "admin" is required`
      });
    }

    console.log('✅ Admin access granted');

    // GET: Get tours pending moderation
    if (req.method === 'GET') {
      const { status = 'pending' } = req.query;
      
      const { data: tours, error } = await supabase
        .from('tours')
        .select(`
          *,
          city:cities(name),
          guide:guides!tours_guide_id_fkey(id, name, avatar_url)
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tours:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch tours',
          message: error.message
        });
      }

      return res.status(200).json({
        success: true,
        tours: tours || []
      });
    }

    // POST/PUT: Approve or reject tour
    if (req.method === 'POST' || req.method === 'PUT') {
      const { tourId, action, comment } = req.body; // action: 'approve' or 'reject'

      if (!tourId || !action) {
        return res.status(400).json({
          success: false,
          error: 'Tour ID and action are required'
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Action must be "approve" or "reject"'
        });
      }

      const updateData = {
        status: action === 'approve' ? 'approved' : 'rejected',
        moderation_comment: comment || null
      };

      if (action === 'approve') {
        updateData.is_published = true;
      }

      const { data: tour, error } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', tourId)
        .select()
        .single();

      if (error) {
        console.error('Error moderating tour:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to moderate tour',
          message: error.message
        });
      }

      return res.status(200).json({
        success: true,
        tour: tour,
        message: `Tour ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Moderate tours error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


