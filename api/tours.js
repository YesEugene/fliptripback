/**
 * Tours Database Module - Unified Tours Endpoint
 * Serverless function to get a single tour or list tours with filters
 * 
 * According to plan: Tours are permanent entities stored in PostgreSQL, not Redis
 * Redis is only for temporary data (itineraries, sessions)
 */

import { supabase } from '../database/db.js';

/**
 * Mapping from location.category (old type) to interest category names
 * This allows filtering by interest categories even when location_interests is empty
 * 
 * location.category values: landmark, museum, restaurant, cafe, park, etc.
 * interest category names: active, culture, food, nature, nightlife, etc.
 */
const LOCATION_CATEGORY_TO_INTEREST_CATEGORY = {
  // Active
  'activity': 'active',
  'sports': 'active',
  'adventure': 'active',
  
  // Culture
  'museum': 'culture',
  'monument': 'culture',
  'theater': 'culture',
  'landmark': 'culture',
  'neighborhood': 'culture',
  
  // Food
  'restaurant': 'food',
  'cafe': 'food',
  'bar': 'food',
  'market': 'food',
  
  // Nature
  'park': 'nature',
  'beach': 'nature',
  
  // Nightlife
  'nightlife': 'nightlife',
  
  // Health
  'wellness': 'health',
  
  // Family (could be various types)
  'park': 'family', // parks can be family-friendly
  'museum': 'family', // museums can be family-friendly
  
  // Romantic (could be various types)
  'restaurant': 'romantic', // restaurants can be romantic
  'park': 'romantic', // parks can be romantic
  
  // Unique Experiences
  'shopping': 'unique',
  'accommodation': 'unique',
  'transport': 'unique',
  'other': 'unique'
};

/**
 * Get all interest names for a given interest category name (e.g., 'active', 'food')
 * Loads from database to get actual interest names
 */
async function getInterestNamesByCategoryName(categoryName, supabaseClient) {
  try {
    // Get category by name (case-insensitive)
    const { data: categories } = await supabaseClient
      .from('interest_categories')
      .select('id, name')
      .ilike('name', categoryName);
    
    if (!categories || categories.length === 0) {
      return [];
    }
    
    // Get all interests from this category (both direct and from subcategories)
    const categoryIds = categories.map(c => c.id);
    const { data: interests } = await supabaseClient
      .from('interests')
      .select('name')
      .in('category_id', categoryIds);
    
    if (interests && interests.length > 0) {
      return interests.map(i => i.name.toLowerCase().trim());
    }
    
    return [];
  } catch (error) {
    console.error('Error getting interests by category:', error);
    return [];
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

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

    const { id } = req.query;

    // If ID is provided, return single tour from PostgreSQL
    if (id) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.error(`❌ Invalid tour ID format: ${id}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid tour ID format'
        });
      }
      
      console.log(`🔍 Fetching tour with ID: ${id}`);
      
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
                location:locations(
                  *,
                  location_interests(
                    interest:interests(id, name, category_id)
                  ),
                  location_photos(
                    id,
                    url,
                    thumbnail_url
                  )
                )
              )
            )
          ),
          tour_tags(
            tag:tags(id, name)
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching tour:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return res.status(500).json({ 
          success: false, 
          message: 'Database error',
          error: error.message
        });
      }

      if (!tour) {
        console.log(`⚠️ Tour not found: ${id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Tour not found' 
        });
      }

      console.log(`✅ Tour found: ${id}, has ${tour.tour_days?.length || 0} days`);

      // Load guide info separately if guide_id exists
      let guideInfo = null;
      if (tour.guide_id) {
        // Note: guides.id = users.id (not user_id)
        const { data: guide } = await supabase
          .from('guides')
          .select('id, name, avatar_url')
          .eq('id', tour.guide_id)
          .maybeSingle();
        if (guide) {
          guideInfo = guide;
        }
      }

      // Extract data from meta JSONB field if it exists
      const meta = tour.meta || {};
      const meetingPoint = meta.meeting_point || null;
      const meetingTime = meta.meeting_time || null;
      const availableDates = meta.available_dates || null;
      const additionalOptions = meta.additional_options || null;
      
      // Convert normalized structure to legacy format for backward compatibility
      const formattedTour = {
        ...tour,
        // Extract city name from city object if it exists
        city: tour.city?.name || tour.city || null,
        // Map preview_media_url to preview for backward compatibility
        preview: tour.preview_media_url || tour.preview || null,
        previewType: tour.preview_media_type || tour.previewType || 'image',
        // Map format for backward compatibility
        format: tour.default_format === 'with_guide' ? 'guided' : (tour.default_format || 'self-guided'),
        withGuide: tour.default_format === 'with_guide',
        // Add price structure with With Guide data
        price: {
          pdfPrice: tour.price_pdf || 16,
          guidedPrice: tour.price_guided || null,
          currency: tour.currency || 'USD',
          meetingPoint: meetingPoint,
          meetingTime: meetingTime,
          availableDates: availableDates
        },
        // Add additional options
        additionalOptions: additionalOptions || {
          platformOptions: ['insurance', 'accommodation'],
          creatorOptions: {}
        },
        daily_plan: convertTourToDailyPlan(tour),
        // Add guide info if available
        guide: guideInfo
      };

      return res.status(200).json({
        success: true,
        tour: formattedTour
      });
    }

    // Otherwise, return list of tours with filters from PostgreSQL
    const { 
      city, 
      format, 
      interests, 
      audience,
      duration,
      languages,
      minPrice,
      maxPrice,
      limit = 50,
      offset = 0
    } = req.query;

    console.log('🔍 Loading tours from database...');
    console.log('📋 Query params:', { city, format, interests, limit, offset });
    
    // Build select query - include location_interests only if filtering by interests
    const baseSelect = `
      *,
      city:cities(name),
      tour_tags(
        tag:tags(id, name)
      )
    `;
    
    const selectWithInterests = `
      *,
      city:cities(name),
      tour_tags(
        tag:tags(id, name)
      ),
      tour_days(
        tour_blocks(
          tour_items(
            location:locations(
              id,
              name,
              location_interests(
                interest:interests(
                  id,
                  name,
                  category_id
                )
              )
            )
          )
        )
      )
    `;
    
    // Use extended query if filtering by interests, otherwise use base query for performance
    const selectQuery = interests ? selectWithInterests : baseSelect;
    
    let query = supabase
      .from('tours')
      .select(selectQuery);
    
    // Filter by status: show only approved tours
    // Use status='approved' if column exists, otherwise fallback to is_published
    // Try status first, if it fails (column doesn't exist), use is_published
    query = query.eq('status', 'approved');
    
    query = query.order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (city) {
      // First, get city ID by name
      const { data: cityData } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', city)
        .limit(1)
        .maybeSingle();
      
      if (cityData && cityData.id) {
        query = query.eq('city_id', cityData.id);
      } else {
        // If city not found, return empty result
        return res.status(200).json({
          success: true,
          tours: [],
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      }
    }

    if (format) {
      query = query.eq('default_format', format);
    }

    if (minPrice !== undefined) {
      query = query.gte('price_pdf', parseFloat(minPrice));
    }

    if (maxPrice !== undefined) {
      query = query.lte('price_pdf', parseFloat(maxPrice));
    }

    const { data: tours, error } = await query;

    console.log('📊 Query result:', {
      count: tours?.length || 0,
      error: error?.message || null,
      errorCode: error?.code || null
    });

    if (error) {
      console.error('❌ Database query error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    // Apply additional filters in memory (for complex filters)
    let filteredTours = tours || [];

    if (interests) {
      const interestList = Array.isArray(interests) ? interests : interests.split(',');
      // Normalize interest names to lowercase for comparison
      const normalizedInterestList = interestList.map(i => i.toLowerCase().trim()).filter(Boolean);
      
      // Pre-load interest category mappings for fallback (location.category -> interest names)
      // This is done once before filtering all tours
      const categoryInterestMap = new Map(); // location.category -> Set of interest names
      
      // Get unique location categories from all tours
      const locationCategories = new Set();
      tours?.forEach(t => {
        if (t.tour_days && Array.isArray(t.tour_days)) {
          t.tour_days.forEach(day => {
            if (day.tour_blocks && Array.isArray(day.tour_blocks)) {
              day.tour_blocks.forEach(block => {
                if (block.tour_items && Array.isArray(block.tour_items)) {
                  block.tour_items.forEach(item => {
                    if (item.location && item.location.category) {
                      locationCategories.add(item.location.category.toLowerCase().trim());
                    }
                  });
                }
              });
            }
          });
        }
      });
      
      // Load interest names for each unique location category (for fallback)
      for (const locCategory of locationCategories) {
        const interestCategoryName = LOCATION_CATEGORY_TO_INTEREST_CATEGORY[locCategory];
        if (interestCategoryName) {
          const interestNames = await getInterestNamesByCategoryName(interestCategoryName, supabase);
          if (interestNames.length > 0) {
            categoryInterestMap.set(locCategory, new Set(interestNames));
          }
        }
      }
      
      filteredTours = filteredTours.filter(t => {
        // Collect all interests from all locations in the tour
        const tourLocationInterests = new Set();
        
        if (t.tour_days && Array.isArray(t.tour_days)) {
          t.tour_days.forEach(day => {
            if (day.tour_blocks && Array.isArray(day.tour_blocks)) {
              day.tour_blocks.forEach(block => {
                if (block.tour_items && Array.isArray(block.tour_items)) {
                  block.tour_items.forEach(item => {
                    if (item.location) {
                      // Method 1: Use location_interests if available
                      if (item.location.location_interests && Array.isArray(item.location.location_interests)) {
                        item.location.location_interests.forEach(li => {
                          if (li.interest && li.interest.name) {
                            tourLocationInterests.add(li.interest.name.toLowerCase().trim());
                          }
                        });
                      }
                      
                      // Method 2: Fallback to location.category mapping (hybrid approach)
                      if (tourLocationInterests.size === 0 && item.location.category) {
                        const locCategory = item.location.category.toLowerCase().trim();
                        const mappedInterests = categoryInterestMap.get(locCategory);
                        if (mappedInterests) {
                          mappedInterests.forEach(interest => {
                            tourLocationInterests.add(interest);
                          });
                        }
                      }
                    }
                  });
                }
              });
            }
          });
        }
        
        // Method 3: Fallback to tour_tags if still no interests found (backward compatibility)
        if (tourLocationInterests.size === 0 && t.tour_tags && Array.isArray(t.tour_tags)) {
          t.tour_tags.forEach(tt => {
            if (tt.tag && tt.tag.name) {
              tourLocationInterests.add(tt.tag.name.toLowerCase().trim());
            }
          });
        }
        
        // Check if at least one interest from filter list matches
        return normalizedInterestList.some(interest => 
          tourLocationInterests.has(interest)
        );
      });
      
      console.log(`🔍 Filtered by interests: ${filteredTours.length} tours match ${normalizedInterestList.length} interest(s)`);
    }

    if (audience) {
      // This would need to be stored in tours table or meta field
      // For now, skip this filter
    }

    if (duration) {
      filteredTours = filteredTours.filter(t => 
        t.duration_type === duration || 
        (duration === 'hours' && t.duration_value <= 12) ||
        (duration === 'days' && t.duration_type === 'days')
      );
    }

    // Load guide info for all tours
    const toursWithGuides = await Promise.all(
      filteredTours.map(async (tour) => {
        let guideInfo = null;
        if (tour.guide_id) {
          // Note: guides.id = users.id (not user_id)
          const { data: guide } = await supabase
            .from('guides')
            .select('id, name, avatar_url')
            .eq('id', tour.guide_id)
            .maybeSingle();
          if (guide) {
            guideInfo = guide;
          }
        }
        return {
          ...tour,
          guide: guideInfo,
          daily_plan: [] // Would need to load full structure for this
        };
      })
    );

    // Convert to legacy format
    const formattedTours = toursWithGuides;

    console.log(`✅ Returning ${formattedTours.length} formatted tours`);

    return res.status(200).json({
      success: true,
      tours: formattedTours,
      total: formattedTours.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Tours error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting tours',
      error: error.message 
    });
  }
}

// Helper function to convert normalized tour structure to daily_plan format
function convertTourToDailyPlan(tour) {
  if (!tour.tour_days || !Array.isArray(tour.tour_days)) {
    return [];
  }

  return tour.tour_days.map(day => {
    const blocks = (day.tour_blocks || []).map(block => {
      const items = (block.tour_items || []).map(item => {
        const location = item.location;
        // Extract interest IDs from location_interests
        const interestIds = location?.location_interests?.map(li => 
          li.interest?.id || li.interest_id
        ).filter(Boolean) || [];
        
        return {
          title: item.custom_title || location?.name || '',
          address: location?.address || '',
          category: location?.category || '',
          why: item.custom_description || location?.description || '',
          tips: item.custom_recommendations || location?.recommendations || '',
          photos: location?.location_photos?.map(p => ({ url: p.url, thumbnail: p.thumbnail_url || p.url })) || [],
          cost: item.approx_cost || 0,
          duration: item.duration_minutes || null,
          price_level: location?.price_level || null,
          interest_ids: interestIds,
          // Keep legacy field names for backward compatibility
          description: item.custom_description || location?.description || '',
          recommendations: item.custom_recommendations || location?.recommendations || '',
          approx_cost: item.approx_cost || 0
        };
      });

      // Format time from start_time and end_time
      let time = null;
      if (block.start_time && block.end_time) {
        // Ensure time format is HH:MM (not HH:MM:SS)
        const formatTime = (timeStr) => {
          if (!timeStr) return null;
          // If time is in HH:MM:SS format, convert to HH:MM
          const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
          return match ? `${match[1].padStart(2, '0')}:${match[2]}` : timeStr;
        };
        const startFormatted = formatTime(block.start_time);
        const endFormatted = formatTime(block.end_time);
        if (startFormatted && endFormatted) {
          time = `${startFormatted} - ${endFormatted}`;
        }
      }
      
      return {
        time: time || '09:00 - 12:00',
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

