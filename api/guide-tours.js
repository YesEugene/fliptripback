/**
 * Guide Tours API - Get tours for current guide/creator
 * Returns all tours created by the authenticated creator
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
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
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Get user from token (same approach as auth-me.js)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Extract user ID from token (same logic as auth-me.js)
    let userId = null;
    try {
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      // Try to decode as base64 (our custom token format)
      try {
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || null;
      } catch (e) {
        // If not base64, try as Supabase JWT
        const { data: { user }, error: authError } = await supabase.auth.getUser(cleanToken);
        if (!authError && user) {
          userId = user.id;
        }
      }
    } catch (error) {
      console.error('Token decode error:', error);
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Get user data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get tours created by this user
    // First, try to detect which column name is used for user/creator
    const testColumns = ['creator_id', 'user_id', 'created_by', 'owner_id', 'guide_id'];
    let userColumnName = null;
    
    // Try each column to see which one exists
    for (const colName of testColumns) {
      const testResult = await supabase
        .from('tours')
        .select('id')
        .eq(colName, userId)
        .limit(1);
      
      // If query succeeds (even with 0 results), column exists
      if (!testResult.error || (testResult.error && testResult.error.code !== '42703')) {
        userColumnName = colName;
        console.log(`✅ Using column '${colName}' for filtering tours`);
        break;
      }
    }
    
    let tours = [];
    let toursError = null;
    
    if (userColumnName) {
      // Query with the correct column name, including normalized structure
      const result = await supabase
        .from('tours')
        .select(`
          *,
          city:cities(name),
          tour_days(
            id,
            day_number,
            title,
            date_hint,
            tour_blocks(
              id,
              start_time,
              end_time,
              title,
              tour_items(
                id,
                location_id,
                custom_title,
                custom_description,
                custom_recommendations,
                order_index,
                duration_minutes,
                approx_cost,
                location:locations(
                  id,
                  name,
                  address,
                  category,
                  description,
                  recommendations,
                  photos:location_photos(url)
                )
              )
            )
          ),
          tour_tags(
            tag:tags(id, name)
          )
        `)
        .eq(userColumnName, userId)
        .order('created_at', { ascending: false });
      
      tours = result.data || [];
      toursError = result.error;
    } else {
      // If no user column found, get all tours and filter in memory
      console.warn('⚠️ No user column found, fetching all tours and filtering in memory');
      const allToursResult = await supabase
        .from('tours')
        .select(`
          *,
          city:cities(name)
        `)
        .order('created_at', { ascending: false });
      
      if (allToursResult.error) {
        toursError = allToursResult.error;
      } else {
        // Filter by checking all possible column names
        const allTours = allToursResult.data || [];
        for (const tour of allTours) {
          if (String(tour.creator_id) === String(userId) || 
              String(tour.user_id) === String(userId) || 
              String(tour.created_by) === String(userId) ||
              String(tour.owner_id) === String(userId) ||
              String(tour.guide_id) === String(userId)) {
            tours.push(tour);
          }
        }
      }
    }

    if (toursError) {
      console.error('Error fetching guide tours:', toursError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tours',
        message: toursError.message
      });
    }

    // Format tours for response
    const formattedTours = (tours || []).map(tour => {
      // Convert normalized structure to daily_plan format for backward compatibility
      let dailyPlan = [];
      
      if (tour.tour_days && Array.isArray(tour.tour_days)) {
        dailyPlan = tour.tour_days.map(day => {
          const blocks = (day.tour_blocks || []).map(block => {
            const items = (block.tour_items || []).map(item => {
              const location = item.location;
              return {
                title: item.custom_title || location?.name || '',
                address: location?.address || '',
                category: location?.category || '',
                why: item.custom_description || location?.description || '',
                tips: item.custom_recommendations || location?.recommendations || '',
                photos: location?.photos?.map(p => p.url) || [],
                cost: item.approx_cost || 0,
                duration: item.duration_minutes || null
              };
            });
            
            return {
              time: block.start_time && block.end_time 
                ? `${block.start_time} - ${block.end_time}`
                : block.start_time || 'TBD',
              title: block.title || null,
              items: items
            };
          });
          
          return {
            day: day.day_number,
            date: day.date_hint || null,
            title: day.title || null,
            blocks: blocks
          };
        });
      }
      
      // Fallback to legacy daily_plan if exists
      if (dailyPlan.length === 0 && tour.daily_plan) {
        dailyPlan = tour.daily_plan;
      }
      
      // Calculate duration from normalized structure or daily_plan
      const totalDays = tour.duration_type === 'days' ? tour.duration_value : (dailyPlan.length || 0);
      let totalHours = tour.duration_type === 'hours' ? tour.duration_value : 0;
      
      if (totalHours === 0 && dailyPlan.length > 0) {
        dailyPlan.forEach(day => {
          if (day.blocks && Array.isArray(day.blocks)) {
            totalHours += day.blocks.length * 3; // Estimate 3 hours per block
          }
        });
      }
      
      // Determine duration type and value
      let duration = { type: 'hours', value: 6 }; // Default
      if (totalDays > 1) {
        duration = { type: 'days', value: totalDays };
      } else if (totalHours > 0) {
        duration = { type: 'hours', value: Math.max(3, Math.min(totalHours, 12)) };
      }
      
      // Extract tags from tour_tags
      const tags = (tour.tour_tags || []).map(tt => tt.tag?.name).filter(Boolean);

      return {
        id: tour.id,
        title: tour.title,
        description: tour.description,
        country: tour.country || null,
        city: tour.city?.name || null,
        city_id: tour.city_id,
        daily_plan: dailyPlan, // Converted from normalized structure
        tags: tags, // From tour_tags
        meta: {}, // Can be extended later
        duration: duration,
        verified: tour.verified || false,
        createdAt: tour.created_at,
        updatedAt: tour.updated_at
      };
    });

    console.log(`✅ Found ${formattedTours.length} tours for creator ${userId}`);

    return res.status(200).json({
      success: true,
      tours: formattedTours,
      total: formattedTours.length
    });

  } catch (error) {
    console.error('❌ Error in guide-tours:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tours',
      message: error.message
    });
  }
}

