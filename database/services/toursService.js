/**
 * Tours Service - Database operations for tours
 */

import { supabase } from '../db.js';

/**
 * Get all tours with filters
 */
export async function getTours(filters = {}) {
  try {
    let query = supabase
      .from('tours')
      .select(`
        *,
        guide:guides(id, name, avatar),
        city:cities(name, country:countries(name)),
        country:countries(name),
        tags:tour_tags(tag:tags(*))
      `);

    if (filters.guide_id) {
      query = query.eq('guide_id', filters.guide_id);
    }
    if (filters.city_id) {
      query = query.eq('city_id', filters.city_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.is_published !== undefined) {
      query = query.eq('is_published', filters.is_published);
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, tours: data || [] };
  } catch (error) {
    console.error('Get tours error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get tour by ID with full structure
 */
export async function getTourById(tourId) {
  try {
    // Get tour basic info
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select(`
        *,
        guide:guides(*),
        city:cities(*, country:countries(*)),
        country:countries(*),
        tags:tour_tags(tag:tags(*)),
        additional_options:tour_additional_options(*)
      `)
      .eq('id', tourId)
      .single();

    if (tourError) throw tourError;

    // Get tour days with blocks and items
    const { data: days, error: daysError } = await supabase
      .from('tour_days')
      .select(`
        *,
        blocks:tour_blocks(
          *,
          items:tour_items(
            *,
            location:locations(*)
          )
        )
      `)
      .eq('tour_id', tourId)
      .order('day_number', { ascending: true });

    if (daysError) throw daysError;

    // Sort blocks and items
    const sortedDays = days.map(day => ({
      ...day,
      blocks: (day.blocks || []).sort((a, b) => a.order_index - b.order_index).map(block => ({
        ...block,
        items: (block.items || []).sort((a, b) => a.order_index - b.order_index)
      }))
    }));

    return {
      success: true,
      tour: {
        ...tour,
        daily_plan: sortedDays
      }
    };
  } catch (error) {
    console.error('Get tour error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create tour with full structure
 */
export async function createTour(tourData, guideId) {
  try {
    // 1. Create tour
    const tour = {
      guide_id: guideId,
      country_id: tourData.country_id,
      city_id: tourData.city_id,
      title: tourData.title,
      description: tourData.description,
      preview_media_url: tourData.preview,
      preview_media_type: tourData.previewType || 'image',
      duration_type: tourData.duration?.type || 'hours',
      duration_value: tourData.duration?.value || 6,
      languages: tourData.languages || ['en'],
      default_format: tourData.withGuide ? 'with_guide' : 'self_guided',
      price_pdf: tourData.price?.pdfPrice || 16,
      price_guided: tourData.price?.guidedPrice,
      currency: tourData.price?.currency || 'USD',
      meeting_point: tourData.price?.meetingPoint,
      meeting_time: tourData.price?.meetingTime,
      available_dates: tourData.price?.availableDates || [],
      status: 'draft'
    };

    const { data: createdTour, error: tourError } = await supabase
      .from('tours')
      .insert(tour)
      .select()
      .single();

    if (tourError) throw tourError;

    // 2. Add tags
    if (tourData.tags && tourData.tags.length > 0) {
      // First, get or create tags
      const tagRelations = [];
      for (const tagName of tourData.tags) {
        // Check if tag exists
        let { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .single();

        let tagId;
        if (!existingTag) {
          // Create tag
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name: tagName, type: 'custom' })
            .select()
            .single();
          tagId = newTag?.id;
        } else {
          tagId = existingTag.id;
        }

        if (tagId) {
          tagRelations.push({ tour_id: createdTour.id, tag_id: tagId });
        }
      }

      if (tagRelations.length > 0) {
        await supabase.from('tour_tags').insert(tagRelations);
      }
    }

    // 3. Add additional options
    if (tourData.additionalOptions) {
      const options = [];
      
      // Platform options (always available)
      if (tourData.additionalOptions.platformOptions) {
        tourData.additionalOptions.platformOptions.forEach(key => {
          options.push({
            tour_id: createdTour.id,
            option_type: 'platform',
            option_key: key,
            option_price: 0
          });
        });
      }

      // Creator options
      if (tourData.additionalOptions.creatorOptions) {
        Object.entries(tourData.additionalOptions.creatorOptions).forEach(([key, price]) => {
          if (price > 0) {
            options.push({
              tour_id: createdTour.id,
              option_type: 'creator',
              option_key: key,
              option_price: price
            });
          }
        });
      }

      if (options.length > 0) {
        await supabase.from('tour_additional_options').insert(options);
      }
    }

    // 4. Create daily plan structure
    if (tourData.daily_plan && tourData.daily_plan.length > 0) {
      for (const dayData of tourData.daily_plan) {
        // Create day
        const { data: day, error: dayError } = await supabase
          .from('tour_days')
          .insert({
            tour_id: createdTour.id,
            day_number: dayData.day || 1,
            title: dayData.title,
            date_hint: dayData.date
          })
          .select()
          .single();

        if (dayError) throw dayError;

        // Create blocks
        if (dayData.blocks && dayData.blocks.length > 0) {
          for (let blockIndex = 0; blockIndex < dayData.blocks.length; blockIndex++) {
            const blockData = dayData.blocks[blockIndex];
            const [startTime, endTime] = blockData.time?.split(' - ') || ['', ''];

            const { data: block, error: blockError } = await supabase
              .from('tour_blocks')
              .insert({
                tour_day_id: day.id,
                start_time: startTime || null,
                end_time: endTime || null,
                title: blockData.title,
                order_index: blockIndex
              })
              .select()
              .single();

            if (blockError) throw blockError;

            // Create items
            if (blockData.items && blockData.items.length > 0) {
              const items = blockData.items.map((itemData, itemIndex) => ({
                tour_block_id: block.id,
                location_id: itemData.location_id || null,
                custom_title: itemData.title,
                custom_description: itemData.description,
                custom_recommendations: itemData.recommendations,
                order_index: itemIndex,
                duration_minutes: itemData.duration,
                approx_cost: itemData.approx_cost
              }));

              await supabase.from('tour_items').insert(items);
            }
          }
        }
      }
    }

    // Return full tour structure
    return await getTourById(createdTour.id);
  } catch (error) {
    console.error('Create tour error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update tour
 */
export async function updateTour(tourId, tourData, guideId) {
  try {
    // Similar to create, but update existing records
    // This is a simplified version - full implementation would handle all nested updates
    const updateFields = {
      title: tourData.title,
      description: tourData.description,
      preview_media_url: tourData.preview,
      preview_media_type: tourData.previewType || 'image',
      duration_type: tourData.duration?.type || 'hours',
      duration_value: tourData.duration?.value || 6,
      languages: tourData.languages || ['en'],
      default_format: tourData.withGuide ? 'with_guide' : 'self_guided',
      price_pdf: tourData.price?.pdfPrice || 16,
      price_guided: tourData.price?.guidedPrice,
      currency: tourData.price?.currency || 'USD',
      meeting_point: tourData.price?.meetingPoint,
      meeting_time: tourData.price?.meetingTime,
      available_dates: tourData.price?.availableDates || []
    };

    const { error } = await supabase
      .from('tours')
      .update(updateFields)
      .eq('id', tourId)
      .eq('guide_id', guideId); // Ensure guide owns the tour

    if (error) throw error;

    // Update tags, options, daily_plan similarly...
    // (Full implementation would handle all nested updates)

    return await getTourById(tourId);
  } catch (error) {
    console.error('Update tour error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete tour
 */
export async function deleteTour(tourId, guideId) {
  try {
    // Verify ownership
    const { data: tour, error: checkError } = await supabase
      .from('tours')
      .select('guide_id')
      .eq('id', tourId)
      .single();

    if (checkError) throw checkError;
    if (tour.guide_id !== guideId) {
      throw new Error('You can only delete your own tours');
    }

    // Delete tour (cascade will handle related records)
    const { error } = await supabase
      .from('tours')
      .delete()
      .eq('id', tourId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete tour error:', error);
    return { success: false, error: error.message };
  }
}

