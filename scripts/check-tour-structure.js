/**
 * Script to check detailed structure of tours in Supabase
 * Shows how many blocks and items each tour has
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTourStructure() {
  console.log('🔍 Checking tour structure in Supabase...\n');

  try {
    // Get all published tours
    const { data: tours, error } = await supabase
      .from('tours')
      .select('id, title, city_id, duration_value')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`📊 Found ${tours.length} published tours\n`);

    for (const tour of tours) {
      // Get days
      const { data: days } = await supabase
        .from('tour_days')
        .select('id, day_number')
        .eq('tour_id', tour.id)
        .order('day_number');

      const dayIds = days?.map(d => d.id) || [];
      
      // Get blocks
      let totalBlocks = 0;
      let totalItems = 0;
      const blocksByDay = {};

      if (dayIds.length > 0) {
        const { data: blocks } = await supabase
          .from('tour_blocks')
          .select('id, tour_day_id, start_time, end_time')
          .in('tour_day_id', dayIds);

        const blockIds = blocks?.map(b => b.id) || [];
        totalBlocks = blockIds.length;

        // Group blocks by day
        blocks?.forEach(block => {
          const day = days.find(d => d.id === block.tour_day_id);
          if (day) {
            if (!blocksByDay[day.day_number]) {
              blocksByDay[day.day_number] = [];
            }
            blocksByDay[day.day_number].push(block);
          }
        });

        // Get items
        if (blockIds.length > 0) {
          const { data: items } = await supabase
            .from('tour_items')
            .select('id, tour_block_id, location_id')
            .in('tour_block_id', blockIds);

          totalItems = items?.length || 0;
        }
      }

      // Get city name
      const { data: city } = await supabase
        .from('cities')
        .select('name')
        .eq('id', tour.city_id)
        .single();

      console.log(`\n📝 ${tour.title}`);
      console.log(`   City: ${city?.name || 'Unknown'}`);
      console.log(`   Duration: ${tour.duration_value || 0} days`);
      console.log(`   Days: ${days?.length || 0}`);
      console.log(`   Blocks: ${totalBlocks}`);
      console.log(`   Items (locations): ${totalItems}`);
      
      // Show blocks per day
      if (Object.keys(blocksByDay).length > 0) {
        console.log(`   Blocks per day:`);
        Object.keys(blocksByDay).sort().forEach(dayNum => {
          console.log(`     Day ${dayNum}: ${blocksByDay[dayNum].length} blocks`);
        });
      }

      if (totalItems === 0) {
        console.log(`   ⚠️  WARNING: No locations found!`);
      } else if (totalItems < 4) {
        console.log(`   ⚠️  WARNING: Very few locations (${totalItems})`);
      }
    }

    console.log('\n\n✅ Check complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkTourStructure().catch(console.error);



