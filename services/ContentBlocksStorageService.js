// ContentBlocksStorageService - Saves content blocks to database
// Handles saving blocks to tour_content_blocks and creating tour_blocks/tour_items for location blocks

import { supabase } from '../database/db.js';

export class ContentBlocksStorageService {
  /**
   * Save all content blocks to database
   * @param {string} tourId - Tour ID
   * @param {Array} contentBlocks - Array of content blocks
   * @param {Array} locations - Original locations array (for location blocks)
   * @returns {Promise<{success: boolean, saved: number, errors: number}>}
   */
  async saveContentBlocks(tourId, contentBlocks, locations = []) {
    if (!tourId || !contentBlocks || !Array.isArray(contentBlocks)) {
      console.error('❌ Invalid parameters for saveContentBlocks');
      return { success: false, saved: 0, errors: 0 };
    }

    console.log(`💾 Saving ${contentBlocks.length} content blocks for tour ${tourId}...`);

    let saved = 0;
    let errors = 0;

    // Create tour_day first (required for location blocks)
    const { data: tourDay, error: dayError } = await supabase
      .from('tour_days')
      .select('id')
      .eq('tour_id', tourId)
      .eq('day_number', 1)
      .single();

    let tourDayId = null;
    if (tourDay) {
      tourDayId = tourDay.id;
    } else {
      // Create tour_day if doesn't exist
      const { data: newTourDay, error: createDayError } = await supabase
        .from('tour_days')
        .insert({
          tour_id: tourId,
          day_number: 1,
          title: 'Day 1'
        })
        .select('id')
        .single();

      if (createDayError || !newTourDay) {
        console.error('❌ Error creating tour_day:', createDayError);
      } else {
        tourDayId = newTourDay.id;
      }
    }

    // Save each block
    for (const block of contentBlocks) {
      try {
        if (block.block_type === 'location') {
          // Location blocks need special handling
          await this.saveLocationBlock(tourId, tourDayId, block, locations);
          saved++;
        } else {
          // Other blocks can be saved directly
          // Log photo blocks to debug photo issues
          if (block.block_type === 'photo' || block.block_type === '3columns') {
            console.log(`💾 Saving ${block.block_type} block:`, {
              blockType: block.block_type,
              hasPhotos: block.block_type === 'photo' ? (block.content?.photos?.length || block.content?.photo) : (block.content?.columns?.some(col => col.photo)),
              photosCount: block.block_type === 'photo' ? (block.content?.photos?.length || 0) : (block.content?.columns?.filter(col => col.photo).length || 0),
              content: block.content
            });
          }
          
          const { error } = await supabase
            .from('tour_content_blocks')
            .insert({
              tour_id: tourId,
              block_type: block.block_type,
              content: block.content,
              order_index: block.order_index
            });

          if (error) {
            console.error(`❌ Error saving ${block.block_type} block:`, error);
            errors++;
          } else {
            saved++;
            if (block.block_type === 'photo' || block.block_type === '3columns') {
              console.log(`✅ ${block.block_type} block saved successfully`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing block ${block.block_type}:`, error);
        errors++;
      }
    }

    console.log(`✅ Saved ${saved} blocks, ${errors} errors`);
    return { success: errors === 0, saved, errors };
  }

  /**
   * Save location block - creates tour_block and tour_items
   * @param {string} tourId - Tour ID
   * @param {string} tourDayId - Tour day ID
   * @param {Object} block - Location block
   * @param {Array} locations - Original locations array
   */
  async saveLocationBlock(tourId, tourDayId, block, locations) {
    if (!tourDayId) {
      console.error('❌ tourDayId is required for location blocks');
      return;
    }

    const mainLocation = block.content?.mainLocation;
    if (!mainLocation) {
      console.error('❌ Location block missing mainLocation');
      return;
    }

    // Find corresponding location from original array
    const originalLocation = locations.find(loc => {
      const name = loc.realPlace?.name || loc.name || loc.title;
      return name === mainLocation.name;
    });

    if (!originalLocation) {
      console.warn(`⚠️ Original location not found for ${mainLocation.name}`);
      return;
    }

    // Parse time from original location
    const time = originalLocation.time || originalLocation.slot?.time || '09:00';
    const [startTime, endTime] = time.includes(' - ') 
      ? time.split(' - ') 
      : [time, null];

    // Create tour_block
    const { data: tourBlock, error: blockError } = await supabase
      .from('tour_blocks')
      .insert({
        tour_day_id: tourDayId,
        start_time: startTime || null,
        end_time: endTime || null,
        title: mainLocation.name
      })
      .select('id')
      .single();

    if (blockError || !tourBlock) {
      console.error('❌ Error creating tour_block:', blockError);
      return;
    }

    const tourBlockId = tourBlock.id;
    const tourItemIds = [];

    // Create tour_item for main location
    let locationId = null;
    if (originalLocation.realPlace?.locationId) {
      locationId = originalLocation.realPlace.locationId;
    }

    const { data: tourItem, error: itemError } = await supabase
      .from('tour_items')
      .insert({
        tour_block_id: tourBlockId,
        location_id: locationId,
        custom_title: mainLocation.name,
        custom_description: mainLocation.description,
        custom_recommendations: mainLocation.recommendation,
        order_index: 0,
        duration_minutes: 90,
        approx_cost: originalLocation.realPlace?.price || null
      })
      .select('id')
      .single();

    if (itemError || !tourItem) {
      console.error('❌ Error creating tour_item:', itemError);
    } else {
      tourItemIds.push(tourItem.id);
    }

    // Ensure alternativeLocations are preserved (they're already in block.content from generation)
    // Note: alternativeLocations are stored in content, not as separate tour_items
    // They're displayed in "Author also recommends" section on frontend
    
    // CRITICAL: Preserve ALL content fields including alternativeLocations
    const preservedAlternativeLocations = block.content?.alternativeLocations || block.content?.alternatives || [];
    
    // Update block content with tour_block_id and tour_item_ids
    // IMPORTANT: Preserve alternativeLocations from block.content
    const updatedContent = {
      ...block.content,
      tour_block_id: tourBlockId,
      tour_item_ids: tourItemIds,
      alternativeLocations: preservedAlternativeLocations
    };
    
    console.log('💾 Saving location block with alternativeLocations:', {
      mainLocation: updatedContent.mainLocation?.title || updatedContent.mainLocation?.name,
      mainLocationPhotos: updatedContent.mainLocation?.photos?.length || 0,
      alternativeLocationsCount: preservedAlternativeLocations.length,
      alternativeLocations: preservedAlternativeLocations.map(alt => ({
        name: alt.name || alt.title,
        photosCount: (alt.photos || (alt.photo ? [alt.photo] : [])).length,
        hasPhotos: !!(alt.photos || alt.photo)
      }))
    });

    // Save content block
    const { error: contentBlockError } = await supabase
      .from('tour_content_blocks')
      .insert({
        tour_id: tourId,
        block_type: 'location',
        content: updatedContent,
        order_index: block.order_index
      });

    if (contentBlockError) {
      console.error('❌ Error saving location content block:', contentBlockError);
    } else {
      console.log('✅ Location block saved successfully with', preservedAlternativeLocations.length, 'alternative locations');
    }
  }
}


