// Admin Tours API - Returns tours for admin dashboard
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers - устанавливаем ПЕРВЫМИ
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  // Helper function to set CORS headers
  const setCorsHeaders = () => {
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  };
  
  setCorsHeaders();

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      if (!supabase) {
        setCorsHeaders();
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id, search, status, city, format } = req.query;

      // If ID is provided, return single tour with full details
      if (id) {
        const { data: tour, error } = await supabase
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
                  location:locations(*)
                )
              )
            ),
            tour_tags(
              tag:tags(id, name)
            )
          `)
          .eq('id', id)
          .single();

        if (error || !tour) {
          setCorsHeaders();
          return res.status(404).json({
            success: false,
            error: 'Tour not found',
            message: error?.message
          });
        }

        // Get guide info if guide_id exists
        let guideInfo = null;
        if (tour.guide_id) {
          const { data: guide } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('id', tour.guide_id)
            .maybeSingle();
          if (guide) {
            guideInfo = guide;
          }
        }

        // Format tour for admin panel
        const formattedTour = {
          id: tour.id,
          title: tour.title,
          description: tour.description,
          city: tour.city?.name || null,
          cityId: tour.city_id,
          country: tour.country || null,
          guide: guideInfo,
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
          isPublished: tour.is_published || false,
          previewMediaUrl: tour.preview_media_url || null,
          previewMediaType: tour.preview_media_type || 'image',
          tags: tour.tour_tags?.map(tt => tt.tag?.name).filter(Boolean) || [],
          tourDays: tour.tour_days || [],
          createdAt: tour.created_at,
          updatedAt: tour.updated_at
        };

        return res.status(200).json({
          success: true,
          tour: formattedTour
        });
      }

      // Use search, status, city, format, source from the destructuring above (line 43)
      const { source } = req.query;
      
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

      // CRITICAL: Filter by source
      // If source='user_generated' is explicitly requested (AI Tours tab), show only AI tours
      // Otherwise (All Tours, Pending, Approved, Rejected), exclude AI tours
      if (source === 'user_generated') {
        query = query.eq('source', 'user_generated');
      } else {
        // Exclude user_generated tours from main tabs
        query = query.or('source.is.null,source.neq.user_generated');
      }

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
        source: tour.source || null, // Include source for frontend filtering
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
      // Ensure CORS headers are set even on error
      setCorsHeaders();
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tours',
        message: error.message
      });
    }
  }

  // Handle PUT/PATCH - update tour (admin can edit any tour)
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      if (!supabase) {
        setCorsHeaders();
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;
      if (!id) {
        setCorsHeaders();
        return res.status(400).json({
          success: false,
          error: 'Tour ID is required'
        });
      }

      const tourData = req.body;
      const { title, description, city, cityId, status, isPublished, tags, previewMediaUrl } = tourData;

      // Validate required fields
      if (!title) {
        setCorsHeaders();
        return res.status(400).json({
          success: false,
          error: 'Title is required'
        });
      }

      // Get or use provided cityId
      let finalCityId = cityId;
      if (!finalCityId && city) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('id')
          .ilike('name', city)
          .limit(1)
          .maybeSingle();
        
        if (cityData) {
          finalCityId = cityData.id;
        }
      }

      // Build update data
      const updateData = {
        title,
        description: description || null,
        status: status || 'draft',
        is_published: isPublished !== undefined ? isPublished : false
      };

      if (finalCityId) {
        updateData.city_id = finalCityId;
      }

      if (previewMediaUrl !== undefined) {
        updateData.preview_media_url = previewMediaUrl || null;
      }

      // Update tour
      const { data: updatedTour, error: updateError } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update tags if provided
      if (tags && Array.isArray(tags)) {
        // Delete existing tags
        await supabase.from('tour_tags').delete().eq('tour_id', id);

        // Add new tags
        if (tags.length > 0) {
          const { data: tagsData } = await supabase
            .from('tags')
            .select('id, name')
            .in('name', tags);

          if (tagsData && tagsData.length > 0) {
            const tourTagInserts = tagsData.map(tag => ({
              tour_id: id,
              tag_id: tag.id
            }));
            await supabase.from('tour_tags').insert(tourTagInserts);
          }
        }
      }

      console.log(`✅ Tour ${id} updated successfully by admin`);

      return res.status(200).json({
        success: true,
        tour: updatedTour,
        message: 'Tour updated successfully'
      });
    } catch (error) {
      console.error('❌ Error updating tour:', error);
      // Ensure CORS headers are set even on error
      setCorsHeaders();
      return res.status(500).json({
        success: false,
        error: 'Failed to update tour',
        message: error.message
      });
    }
  }

  // Handle DELETE - delete tour
  if (req.method === 'DELETE') {
    try {
      if (!supabase) {
        setCorsHeaders();
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;

      if (!id) {
        setCorsHeaders();
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
      // Ensure CORS headers are set even on error
      setCorsHeaders();
      return res.status(500).json({
        success: false,
        error: 'Failed to delete tour',
        message: error.message
      });
    }
  }

  // Method not allowed
  setCorsHeaders();
  return res.status(405).json({ error: 'Method not allowed' });
}

