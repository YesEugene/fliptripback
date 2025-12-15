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
            location:locations(
              *,
              tags:location_tags(tag:tags(*))
            )
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
      preview_media_url: tourData.preview_media_url || tourData.preview,
      preview_media_type: tourData.preview_media_type || tourData.previewType || 'image',
      duration_type: tourData.duration_type || tourData.duration?.type || 'hours',
      duration_value: tourData.duration_value || tourData.duration?.value || 6,
      languages: tourData.languages || ['en'],
      default_format: tourData.default_format || (tourData.withGuide ? 'with_guide' : 'self_guided'),
      price_pdf: tourData.price_pdf || tourData.price?.pdfPrice || 16,
      price_guided: tourData.price_guided || tourData.price?.guidedPrice,
      currency: tourData.currency || tourData.price?.currency || 'USD',
      meeting_point: tourData.meeting_point || tourData.price?.meetingPoint,
      meeting_time: tourData.meeting_time || tourData.price?.meetingTime,
      available_dates: tourData.available_dates || tourData.price?.availableDates || [],
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
            day_number: dayData.day || dayData.day_number || 1,
            title: dayData.title,
            date_hint: dayData.date || dayData.date_hint
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
                start_time: startTime || blockData.start_time || null,
                end_time: endTime || blockData.end_time || null,
                title: blockData.title,
                order_index: blockIndex
              })
              .select()
              .single();

            if (blockError) throw blockError;

            // Create items
            if (blockData.items && blockData.items.length > 0) {
              const itemsToInsert = [];
              
              for (let itemIndex = 0; itemIndex < blockData.items.length; itemIndex++) {
                const itemData = blockData.items[itemIndex];
                let locationId = itemData.location_id || null;
                
                // If no location_id but we have location data, create or find location
                if (!locationId && itemData.title && tourData.city_id) {
                  // Try to find existing location by name and city
                  const { data: existingLocation } = await supabase
                    .from('locations')
                    .select('id')
                    .eq('city_id', tourData.city_id)
                    .ilike('name', itemData.title)
                    .limit(1)
                    .single();
                  
                  if (existingLocation) {
                    locationId = existingLocation.id;
                  } else {
                    // Create new location
                    const { data: newLocation, error: locError } = await supabase
                      .from('locations')
                      .insert({
                        city_id: tourData.city_id,
                        name: itemData.title,
                        address: itemData.address || null,
                        category: itemData.category || null,
                        description: itemData.description || null,
                        recommendations: itemData.recommendations || null,
                        verified: false,
                        source: 'guide'
                      })
                      .select()
                      .single();
                    
                    if (!locError && newLocation) {
                      locationId = newLocation.id;
                      
                      // Add tags to location if provided
                      if (itemData.tag_ids && itemData.tag_ids.length > 0) {
                        const locationTagRelations = itemData.tag_ids.map(tagId => ({
                          location_id: locationId,
                          tag_id: tagId
                        }));
                        await supabase.from('location_tags').insert(locationTagRelations);
                      }
                    }
                  }
                } else if (locationId && itemData.tag_ids && itemData.tag_ids.length > 0) {
                  // Update existing location with tags
                  // First remove existing tags for this location
                  await supabase.from('location_tags').delete().eq('location_id', locationId);
                  // Then add new tags
                  const locationTagRelations = itemData.tag_ids.map(tagId => ({
                    location_id: locationId,
                    tag_id: tagId
                  }));
                  await supabase.from('location_tags').insert(locationTagRelations);
                }
                
                itemsToInsert.push({
                  tour_block_id: block.id,
                  location_id: locationId,
                  custom_title: itemData.title || itemData.custom_title,
                  custom_description: itemData.description || itemData.custom_description,
                  custom_recommendations: itemData.recommendations || itemData.custom_recommendations,
                  order_index: itemIndex,
                  duration_minutes: itemData.duration || itemData.duration_minutes,
                  approx_cost: itemData.approx_cost
                });
              }

              await supabase.from('tour_items').insert(itemsToInsert);
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
 * Update tour with full structure
 */
export async function updateTour(tourId, tourData, guideId) {
  try {
    // 1. Update basic tour info
    const updateFields = {
      title: tourData.title,
      description: tourData.description,
      preview_media_url: tourData.preview_media_url || tourData.preview,
      preview_media_type: tourData.preview_media_type || tourData.previewType || 'image',
      duration_type: tourData.duration_type || tourData.duration?.type || 'hours',
      duration_value: tourData.duration_value || tourData.duration?.value || 6,
      languages: tourData.languages || ['en'],
      default_format: tourData.default_format || (tourData.withGuide ? 'with_guide' : 'self_guided'),
      price_pdf: tourData.price_pdf || tourData.price?.pdfPrice || 16,
      price_guided: tourData.price_guided || tourData.price?.guidedPrice,
      currency: tourData.currency || tourData.price?.currency || 'USD',
      meeting_point: tourData.meeting_point || tourData.price?.meetingPoint,
      meeting_time: tourData.meeting_time || tourData.price?.meetingTime,
      available_dates: tourData.available_dates || tourData.price?.availableDates || []
    };

    // Remove null/undefined fields
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined || updateFields[key] === null) {
        delete updateFields[key];
      }
    });

    const { error: updateError } = await supabase
      .from('tours')
      .update(updateFields)
      .eq('id', tourId)
      .eq('guide_id', guideId);

    if (updateError) throw updateError;

    // 2. Update tags
    if (tourData.tags !== undefined) {
      // Delete existing tags
      await supabase.from('tour_tags').delete().eq('tour_id', tourId);
      
      // Add new tags
      if (tourData.tags.length > 0) {
        const tagRelations = [];
        for (const tagName of tourData.tags) {
          let { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('name', tagName)
            .single();

          let tagId;
          if (!existingTag) {
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
            tagRelations.push({ tour_id: tourId, tag_id: tagId });
          }
        }

        if (tagRelations.length > 0) {
          await supabase.from('tour_tags').insert(tagRelations);
        }
      }
    }

    // 3. Update additional options
    if (tourData.additionalOptions) {
      // Delete existing options
      await supabase.from('tour_additional_options').delete().eq('tour_id', tourId);
      
      // Add new options
      const options = [];
      
      if (tourData.additionalOptions.platformOptions) {
        tourData.additionalOptions.platformOptions.forEach(key => {
          options.push({
            tour_id: tourId,
            option_type: 'platform',
            option_key: key,
            option_price: 0
          });
        });
      }

      if (tourData.additionalOptions.creatorOptions) {
        Object.entries(tourData.additionalOptions.creatorOptions).forEach(([key, price]) => {
          if (price > 0) {
            options.push({
              tour_id: tourId,
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

    // 4. Update daily plan (delete and recreate for simplicity)
    if (tourData.daily_plan !== undefined) {
      // Get existing days to delete
      const { data: existingDays } = await supabase
        .from('tour_days')
        .select('id')
        .eq('tour_id', tourId);

      if (existingDays && existingDays.length > 0) {
        // Delete all related data (cascade should handle this, but we'll be explicit)
        for (const day of existingDays) {
          const { data: blocks } = await supabase
            .from('tour_blocks')
            .select('id')
            .eq('tour_day_id', day.id);

          if (blocks) {
            for (const block of blocks) {
              await supabase.from('tour_items').delete().eq('tour_block_id', block.id);
            }
            await supabase.from('tour_blocks').delete().eq('tour_day_id', day.id);
          }
        }
        await supabase.from('tour_days').delete().eq('tour_id', tourId);
      }

      // Create new daily plan
      if (tourData.daily_plan.length > 0) {
        for (const dayData of tourData.daily_plan) {
          const { data: day, error: dayError } = await supabase
            .from('tour_days')
            .insert({
              tour_id: tourId,
              day_number: dayData.day || dayData.day_number || 1,
              title: dayData.title,
              date_hint: dayData.date || dayData.date_hint
            })
            .select()
            .single();

          if (dayError) throw dayError;

          if (dayData.blocks && dayData.blocks.length > 0) {
            for (let blockIndex = 0; blockIndex < dayData.blocks.length; blockIndex++) {
              const blockData = dayData.blocks[blockIndex];
              const [startTime, endTime] = blockData.time?.split(' - ') || ['', ''];

              const { data: block, error: blockError } = await supabase
                .from('tour_blocks')
                .insert({
                  tour_day_id: day.id,
                  start_time: startTime || blockData.start_time || null,
                  end_time: endTime || blockData.end_time || null,
                  title: blockData.title,
                  order_index: blockIndex
                })
                .select()
                .single();

              if (blockError) throw blockError;

              if (blockData.items && blockData.items.length > 0) {
                const itemsToInsert = [];
                
                for (let itemIndex = 0; itemIndex < blockData.items.length; itemIndex++) {
                  const itemData = blockData.items[itemIndex];
                  let locationId = itemData.location_id || null;
                  
                  // If no location_id but we have location data, create or find location
                  if (!locationId && itemData.title && tourData.city_id) {
                    // Try to find existing location by name and city
                    const { data: existingLocation } = await supabase
                      .from('locations')
                      .select('id')
                      .eq('city_id', tourData.city_id)
                      .ilike('name', itemData.title)
                      .limit(1)
                      .single();
                    
                    if (existingLocation) {
                      locationId = existingLocation.id;
                    } else {
                      // Create new location
                      const { data: newLocation, error: locError } = await supabase
                        .from('locations')
                        .insert({
                          city_id: tourData.city_id,
                          name: itemData.title,
                          address: itemData.address || null,
                          category: itemData.category || null,
                          description: itemData.description || null,
                          recommendations: itemData.recommendations || null,
                          verified: false,
                          source: 'guide'
                        })
                        .select()
                        .single();
                      
                      if (!locError && newLocation) {
                        locationId = newLocation.id;
                        
                        // Add tags to location if provided
                        if (itemData.tag_ids && itemData.tag_ids.length > 0) {
                          const locationTagRelations = itemData.tag_ids.map(tagId => ({
                            location_id: locationId,
                            tag_id: tagId
                          }));
                          await supabase.from('location_tags').insert(locationTagRelations);
                        }
                      }
                    }
                  } else if (locationId && itemData.tag_ids && itemData.tag_ids.length > 0) {
                    // Update existing location with tags
                    // First remove existing tags for this location
                    await supabase.from('location_tags').delete().eq('location_id', locationId);
                    // Then add new tags
                    const locationTagRelations = itemData.tag_ids.map(tagId => ({
                      location_id: locationId,
                      tag_id: tagId
                    }));
                    await supabase.from('location_tags').insert(locationTagRelations);
                  }
                  
                  itemsToInsert.push({
                    tour_block_id: block.id,
                    location_id: locationId,
                    custom_title: itemData.title || itemData.custom_title,
                    custom_description: itemData.description || itemData.custom_description,
                    custom_recommendations: itemData.recommendations || itemData.custom_recommendations,
                    order_index: itemIndex,
                    duration_minutes: itemData.duration || itemData.duration_minutes,
                    approx_cost: itemData.approx_cost
                  });
                }

                await supabase.from('tour_items').insert(itemsToInsert);
              }
            }
          }
        }
      }
    }

    // Return updated tour
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
