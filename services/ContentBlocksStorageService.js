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

    // Create tour_items for alternatives (if any)
    if (block.content?.alternatives && Array.isArray(block.content.alternatives)) {
      block.content.alternatives.forEach((alt, index) => {
        // Note: Alternatives are stored as tour_items but may not have location_id
        // They're stored for reference but the main location is the primary one
      });
    }

    // Update block content with tour_block_id and tour_item_ids
    const updatedContent = {
      ...block.content,
      tour_block_id: tourBlockId,
      tour_item_ids: tourItemIds
    };

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
    }
  }
}


