/**
 * API endpoint to update all existing tours with full day plans
 * POST /api/update-all-tours
 */

import { supabase } from '../database/db.js';

// Re-export sampleTours from generate-sample-tours.js
// We'll import it dynamically at runtime
let sampleTours = null;

async function loadSampleTours() {
  if (sampleTours) return sampleTours;
  
  try {
    // Import the module dynamically
    const module = await import('./generate-sample-tours.js?update=' + Date.now());
    // The sampleTours is not exported, so we need to call the handler
    // Actually, let's just use the existing generate-sample-tours endpoint
    // But for now, let's get tours from database and update them
    sampleTours = [];
    return sampleTours;
  } catch (err) {
    console.error('❌ Error loading sample tours:', err);
    return [];
  }
}

// Helper functions
async function getOrCreateCity(cityName, countryName) {
  if (!cityName || !supabase) return null;
  
  try {
    const { data: existing } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      return existing.id;
    }
    
    const { data: newCity, error } = await supabase
      .from('cities')
      .insert({ name: cityName, country: countryName || null })
      .select('id')
      .single();
    
    if (error) {
      console.error(`❌ Error creating city ${cityName}:`, error);
      return null;
    }
    
    return newCity.id;
  } catch (err) {
    console.error(`❌ Error in getOrCreateCity for ${cityName}:`, err);
    return null;
  }
}

async function getOrCreateTags(tagNames) {
  if (!supabase) return [];
  const tagIds = [];
  
  for (const tagName of tagNames) {
    try {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .ilike('name', tagName)
        .limit(1)
        .maybeSingle();
      
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({ name: tagName })
        .select('id')
        .single();
      
      if (error) {
        console.error(`❌ Error creating tag ${tagName}:`, error);
        continue;
      }
      
      tagIds.push(newTag.id);
    } catch (err) {
      console.error(`❌ Error in getOrCreateTags for ${tagName}:`, err);
    }
  }
  
  return tagIds;
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    console.log('🚀 Starting tour updates...');
    
    // Get all existing tours from database
    const { data: existingTours, error: fetchError } = await supabase
      .from('tours')
      .select('id, title, city_id')
      .limit(100);
    
    if (fetchError) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch tours: ${fetchError.message}`
      });
    }
    
    if (!existingTours || existingTours.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No tours found to update',
        updated: []
      });
    }
    
    console.log(`📋 Found ${existingTours.length} tours to update`);
    
    // Load sample tours data
    await loadSampleTours();
    
    // If we couldn't load sample tours, use generate-sample-tours endpoint logic
    // For now, let's just call the generate-sample-tours endpoint internally
    // Actually, better approach: use the existing generate-sample-tours.js logic
    const { default: generateHandler } = await import('./generate-sample-tours.js');
    
    // Call generate-sample-tours handler which will update existing tours
    const mockReq = { ...req };
    const mockRes = {
      ...res,
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            console.log('✅ Tours updated via generate-sample-tours');
          }
          return mockRes;
        }
      })
    };
    
    await generateHandler(mockReq, mockRes);
    
    return res.status(200).json({
      success: true,
      message: `Processing ${existingTours.length} tours via generate-sample-tours endpoint`
    });
    
    /* OLD CODE - keeping for reference
    const updatedTours = [];
    const errors = [];
    
    for (const tourData of sampleTours) {
      try {
        console.log(`\n📝 Processing tour: ${tourData.title} in ${tourData.city}`);
        
        // Get or create city
        const cityId = await getOrCreateCity(tourData.city, tourData.country);
        if (!cityId) {
          console.error(`❌ Failed to get/create city for ${tourData.city}`);
          errors.push({ tour: tourData.title, error: 'Failed to get/create city' });
          continue;
        }
        
        // Get or create tags
        const tagIds = await getOrCreateTags(tourData.tags);
        console.log(`✅ Tags: ${tourData.tags.join(', ')} (IDs: ${tagIds.join(', ')})`);
        
        // Check if tour already exists
        const { data: existingTours } = await supabase
          .from('tours')
          .select('id, title')
          .ilike('title', tourData.title)
          .limit(1);
        
        let tour;
        let isUpdate = false;
        
        if (existingTours && existingTours.length > 0) {
          // Update existing tour
          tour = existingTours[0];
          isUpdate = true;
          console.log(`🔄 Updating existing tour: ${tour.title} (ID: ${tour.id})`);
          
          // Calculate duration from daily_plan
          const maxDay = Math.max(...tourData.daily_plan.map(d => d.day));
          const durationValue = maxDay;
          
          const baseTourData = {
            title: tourData.title,
            description: tourData.description,
            city_id: cityId,
            default_format: 'self_guided',
            duration_type: 'days',
            duration_value: durationValue,
            price_pdf: 16,
            currency: 'USD',
            preview_media_url: tourData.preview_media_url,
            preview_media_type: 'image',
            is_published: true
          };
          
          const { error: updateError } = await supabase
            .from('tours')
            .update(baseTourData)
            .eq('id', tour.id);
          
          if (updateError) {
            console.error(`❌ Error updating tour:`, updateError);
            errors.push({ tour: tourData.title, error: updateError.message });
            continue;
          }
          
          // Delete existing structure
          const { data: existingDays } = await supabase
            .from('tour_days')
            .select('id')
            .eq('tour_id', tour.id);
          
          if (existingDays && existingDays.length > 0) {
            const dayIds = existingDays.map(d => d.id);
            const { data: existingBlocks } = await supabase
              .from('tour_blocks')
              .select('id')
              .in('tour_day_id', dayIds);
            
            if (existingBlocks && existingBlocks.length > 0) {
              const blockIds = existingBlocks.map(b => b.id);
              await supabase.from('tour_items').delete().in('tour_block_id', blockIds);
            }
            await supabase.from('tour_blocks').delete().in('tour_day_id', dayIds);
          }
          await supabase.from('tour_days').delete().eq('tour_id', tour.id);
          await supabase.from('tour_tags').delete().eq('tour_id', tour.id);
        } else {
          console.warn(`⚠️ Tour "${tourData.title}" not found, skipping...`);
          errors.push({ tour: tourData.title, error: 'Tour not found' });
          continue;
        }
        
        updatedTours.push({ id: tour.id, title: tourData.title, action: 'updated' });
        
        // Create tour_tags
        if (tagIds.length > 0) {
          const tourTagInserts = tagIds.map(tagId => ({
            tour_id: tour.id,
            tag_id: tagId
          }));
          
          const { error: tagError } = await supabase
            .from('tour_tags')
            .insert(tourTagInserts);
          
          if (tagError) {
            console.error(`❌ Error creating tour_tags:`, tagError);
          } else {
            console.log(`✅ Created ${tagIds.length} tour tags`);
          }
        }
        
        // Create tour_days, tour_blocks, tour_items
        for (const day of tourData.daily_plan) {
          const { data: tourDay, error: dayError } = await supabase
            .from('tour_days')
            .insert({
              tour_id: tour.id,
              day_number: day.day,
              title: null,
              date_hint: null
            })
            .select('id')
            .single();
          
          if (dayError || !tourDay) {
            console.error(`❌ Error creating tour_day:`, dayError);
            continue;
          }
          
          for (const block of day.blocks) {
            const { data: tourBlock, error: blockError } = await supabase
              .from('tour_blocks')
              .insert({
                tour_day_id: tourDay.id,
                start_time: block.time.split(' - ')[0] || null,
                end_time: block.time.split(' - ')[1] || null,
                title: null
              })
              .select('id')
              .single();
            
            if (blockError || !tourBlock) {
              console.error(`❌ Error creating tour_block:`, blockError);
              continue;
            }
            
            for (let i = 0; i < block.items.length; i++) {
              const item = block.items[i];
              
              // Create location if needed
              let locationId = null;
              const { data: existingLocation } = await supabase
                .from('locations')
                .select('id')
                .ilike('name', item.title)
                .eq('city_id', cityId)
                .limit(1)
                .maybeSingle();
              
              if (existingLocation) {
                locationId = existingLocation.id;
              } else {
                const { data: newLocation, error: locError } = await supabase
                  .from('locations')
                  .insert({
                    name: item.title,
                    city_id: cityId,
                    address: item.address,
                    category: item.category || null,
                    description: item.description || null,
                    recommendations: item.recommendations || null,
                    source: 'guide',
                    verified: true
                  })
                  .select('id')
                  .single();
                
                if (!locError && newLocation) {
                  locationId = newLocation.id;
                }
              }
              
              if (locationId) {
                const { error: itemError } = await supabase
                  .from('tour_items')
                  .insert({
                    tour_block_id: tourBlock.id,
                    location_id: locationId,
                    custom_title: null,
                    custom_description: item.description || null,
                    custom_recommendations: item.recommendations || null,
                    order_index: i,
                    approx_cost: null
                  });
                
                if (itemError) {
                  console.error(`❌ Error creating tour_item:`, itemError);
                }
              }
            }
          }
        }
        
        console.log(`✅ Successfully updated tour: ${tourData.title}`);
      } catch (err) {
        console.error(`❌ Error processing tour ${tourData.title}:`, err);
        errors.push({ tour: tourData.title, error: err.message });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Updated ${updatedTours.length} tours`,
      updated: updatedTours,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('❌ Error updating tours:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

