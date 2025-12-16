// Admin Tours API - Returns tours for admin dashboard
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

  if (req.method === 'GET') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { search, status, city, format } = req.query;

      let query = supabase
        .from('tours')
        .select(`
          *,
          city:cities(name),
          tour_tags(
            tag:tags(id, name)
          )
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (city) {
        query = query.eq('city_id', city);
      }

      if (format) {
        query = query.eq('default_format', format);
      }

      const { data: tours, error } = await query;

      if (error) {
        throw error;
      }

      // Get guide emails separately if guide_id exists
      const guideIds = [...new Set((tours || []).map(t => t.guide_id).filter(Boolean))];
      const guideEmailsMap = {};
      
      if (guideIds.length > 0) {
        const { data: guides } = await supabase
          .from('users')
          .select('id, email')
          .in('id', guideIds);
        
        if (guides) {
          guides.forEach(guide => {
            guideEmailsMap[guide.id] = guide.email;
          });
        }
      }

      // Format tours for display
      const formattedTours = (tours || []).map(tour => ({
        id: tour.id,
        title: tour.title,
        description: tour.description,
        city: tour.city?.name || tour.city_id,
        country: tour.country || null,
        guide: tour.guide_id ? (guideEmailsMap[tour.guide_id] || 'N/A') : 'N/A',
        guideId: tour.guide_id || null,
        duration: {
          type: tour.duration_type || 'hours',
          value: tour.duration_value || 6
        },
        format: tour.default_format || 'self_guided',
        price: {
          pdf: tour.price_pdf || 16,
          guided: tour.price_guided || null,
          currency: tour.currency || 'USD'
        },
        status: tour.status || 'draft',
        verified: tour.verified || false,
        isPublished: tour.is_published || false,
        tags: tour.tour_tags?.map(tt => tt.tag?.name).filter(Boolean) || [],
        createdAt: tour.created_at,
        updatedAt: tour.updated_at
      }));

      return res.status(200).json({
        success: true,
        tours: formattedTours
      });
    } catch (error) {
      console.error('❌ Error fetching tours:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tours',
        message: error.message
      });
    }
  }

  // Handle DELETE - delete tour
  if (req.method === 'DELETE') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Tour ID is required'
        });
      }

      // Delete tour (CASCADE will handle related records: tour_days, tour_blocks, tour_items, tour_tags)
      const { error: deleteError } = await supabase
        .from('tours')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      console.log(`✅ Tour ${id} deleted successfully`);

      return res.status(200).json({
        success: true,
        message: 'Tour deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting tour:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete tour',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

