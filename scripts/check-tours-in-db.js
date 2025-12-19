/**
 * Script to check what tours exist in Supabase database
 * Run with: node scripts/check-tours-in-db.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please set these environment variables or pass them as arguments');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTours() {
  console.log('🔍 Checking tours in Supabase database...\n');

  try {
    // Get all tours
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select('id, title, description, city_id, duration_value, is_published, created_at')
      .order('created_at', { ascending: false });

    if (toursError) {
      console.error('❌ Error fetching tours:', toursError);
      return;
    }

    console.log(`📊 Total tours in database: ${tours?.length || 0}\n`);

    if (!tours || tours.length === 0) {
      console.log('⚠️ No tours found in database!');
      return;
    }

    // Get detailed info for each tour
    for (const tour of tours.slice(0, 10)) {
      console.log(`\n📝 Tour: ${tour.title}`);
      console.log(`   ID: ${tour.id}`);
      console.log(`   Duration: ${tour.duration_value || 'N/A'} days`);
      console.log(`   Published: ${tour.is_published ? 'Yes' : 'No'}`);
      console.log(`   Created: ${tour.created_at}`);

      // Count days, blocks, items
      const { data: days } = await supabase
        .from('tour_days')
        .select('id')
        .eq('tour_id', tour.id);

      const dayIds = days?.map(d => d.id) || [];
      let totalBlocks = 0;
      let totalItems = 0;

      if (dayIds.length > 0) {
        const { data: blocks } = await supabase
          .from('tour_blocks')
          .select('id')
          .in('tour_day_id', dayIds);

        const blockIds = blocks?.map(b => b.id) || [];
        totalBlocks = blockIds.length;

        if (blockIds.length > 0) {
          const { data: items } = await supabase
            .from('tour_items')
            .select('id')
            .in('tour_block_id', blockIds);

          totalItems = items?.length || 0;
        }
      }

      console.log(`   Structure: ${days?.length || 0} days, ${totalBlocks} blocks, ${totalItems} items`);

      // Get city name
      if (tour.city_id) {
        const { data: city } = await supabase
          .from('cities')
          .select('name')
          .eq('id', tour.city_id)
          .single();
        console.log(`   City: ${city?.name || 'Unknown'}`);
      }
    }

    // Summary
    console.log('\n\n📈 Summary:');
    console.log(`   Total tours: ${tours.length}`);
    console.log(`   Published: ${tours.filter(t => t.is_published).length}`);
    console.log(`   Unpublished: ${tours.filter(t => !t.is_published).length}`);

    // Check locations
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('id')
      .limit(1);

    console.log(`   Total locations in DB: ${locations ? 'Yes (at least 1)' : 'None'}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkTours().catch(console.error);

