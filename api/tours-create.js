/**
 * Tours Create API - Create new tour and save to Redis + locations to database
 * Serverless function to create tours (save to Redis) and extract/save locations (to DB)
 */

import { Redis } from '@upstash/redis';
import { supabase } from '../database/db.js';
import { getOrCreateCity } from '../database/services/citiesService.js';
import { v4 as uuidv4 } from 'uuid';

// Lazy initialization of Redis client
function getRedis() {
  const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis environment variables not set');
  }
  
  return new Redis({ url, token });
}

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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Get user from token (same approach as auth-me.js)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Extract user ID from token (same logic as auth-me.js)
    let userId = null;
    try {
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      // Try to decode as base64 (our custom token format)
      try {
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || null;
      } catch (e) {
        // If not base64, try as Supabase JWT
        const { data: { user }, error: authError } = await supabase.auth.getUser(cleanToken);
        if (!authError && user) {
          userId = user.id;
        }
      }
    } catch (error) {
      console.error('Token decode error:', error);
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Get user data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData || userData.role !== 'creator') {
      return res.status(403).json({
        success: false,
        error: 'Only creators can create tours'
      });
    }

    const tourData = req.body;
    const { country, city, title, description, daily_plan, tags, meta } = tourData;

    if (!city || !title) {
      return res.status(400).json({
        success: false,
        error: 'City and title are required'
      });
    }

    // Get or create city
    const cityId = await getOrCreateCity(city, country);

    // Extract locations from daily_plan
    const locationsToSave = [];
    if (daily_plan && Array.isArray(daily_plan)) {
      for (const day of daily_plan) {
        if (day.blocks && Array.isArray(day.blocks)) {
          for (const block of day.blocks) {
            if (block.items && Array.isArray(block.items)) {
              for (const item of block.items) {
                if (item.title && item.address) {
                  // Check if location already exists
                  const { data: existingLocation } = await supabase
                    .from('locations')
                    .select('id')
                    .eq('name', item.title)
                    .eq('city_id', cityId)
                    .single();

                  if (!existingLocation) {
                    // Create new location
                    const locationData = {
                      name: item.title,
                      city_id: cityId,
                      address: item.address,
                      category: item.category || null,
                      description: item.why || item.description || null,
                      recommendations: item.tips || item.recommendations || null,
                      tags: tags || [],
                      verified: false, // Created by creator, needs admin verification
                      created_by: userId
                    };

                    const { data: newLocation, error: locationError } = await supabase
                      .from('locations')
                      .insert(locationData)
                      .select()
                      .single();

                    if (!locationError && newLocation) {
                      locationsToSave.push(newLocation.id);

                      // Save photos if provided
                      if (item.photos && Array.isArray(item.photos) && item.photos.length > 0) {
                        const photoInserts = item.photos.map(photo => ({
                          location_id: newLocation.id,
                          url: typeof photo === 'string' ? photo : (photo.url || ''),
                          source: 'user'
                        })).filter(p => p.url);
                        
                        if (photoInserts.length > 0) {
                          await supabase.from('location_photos').insert(photoInserts);
                        }
                      }

                      // Link interests if provided in meta
                      if (meta && meta.interests && Array.isArray(meta.interests) && meta.interests.length > 0) {
                        // Get interest IDs by names
                        const { data: interestsData } = await supabase
                          .from('interests')
                          .select('id')
                          .in('name', meta.interests);

                        if (interestsData && interestsData.length > 0) {
                          const interestInserts = interestsData.map(interest => ({
                            location_id: newLocation.id,
                            interest_id: interest.id
                          }));
                          await supabase.from('location_interests').insert(interestInserts);
                        }
                      }
                    }
                  } else {
                    locationsToSave.push(existingLocation.id);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Save tour to database in normalized structure
    // First, determine which column to use for guide_id
    let userColumnName = 'guide_id'; // Default according to plan
    
    // Test if guide_id column exists, if not try other options
    const testResult = await supabase
      .from('tours')
      .select('id')
      .eq('guide_id', userId)
      .limit(1);
    
    if (testResult.error && testResult.error.code === '42703') {
      // guide_id doesn't exist, try other columns
      const testColumns = ['creator_id', 'user_id', 'created_by'];
      for (const colName of testColumns) {
        const test = await supabase
          .from('tours')
          .select('id')
          .eq(colName, userId)
          .limit(1);
        
        if (!test.error || test.error.code !== '42703') {
          userColumnName = colName;
          console.log(`✅ Using existing column: ${colName}`);
          break;
        }
      }
    } else {
      console.log('✅ Using guide_id column');
    }
    
    // Calculate duration from daily_plan
    const totalDays = daily_plan?.length || 0;
    let durationType = 'hours';
    let durationValue = 6; // Default
    
    if (totalDays > 1) {
      durationType = 'days';
      durationValue = totalDays;
    } else if (daily_plan && daily_plan.length > 0) {
      // Estimate hours from blocks
      let totalBlocks = 0;
      daily_plan.forEach(day => {
        if (day.blocks && Array.isArray(day.blocks)) {
          totalBlocks += day.blocks.length;
        }
      });
      durationValue = Math.max(3, Math.min(totalBlocks * 3, 12));
    }
    
    // Extract format and pricing from tourData
    const format = tourData.format || 'self_guided';
    const pricePdf = tourData.price?.pdfPrice || 16.00;
    const priceGuided = tourData.price?.guidedPrice || null;
    const previewMediaUrl = tourData.preview || null;
    const previewMediaType = tourData.previewType || 'image';
    
    // 1. Create main tour record
    const baseTourData = {
      [userColumnName]: userId,
      country: country || null,
      city_id: cityId,
      title,
      description: description || null,
      duration_type: durationType,
      duration_value: durationValue,
      default_format: format,
      price_pdf: pricePdf,
      price_guided: priceGuided,
      currency: tourData.price?.currency || 'USD',
      preview_media_url: previewMediaUrl,
      preview_media_type: previewMediaType,
      is_published: false,
      status: 'draft',
      verified: false
    };
    
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .insert(baseTourData)
      .select()
      .single();

    if (tourError) {
      console.error('Error creating tour:', tourError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create tour',
        message: tourError.message
      });
    }

    console.log(`✅ Tour created: ${tour.id}`);

    // 2. Save tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Get tag IDs by names
      const { data: tagsData } = await supabase
        .from('tags')
        .select('id, name')
        .in('name', tags);
      
      if (tagsData && tagsData.length > 0) {
        const tourTagInserts = tagsData.map(tag => ({
          tour_id: tour.id,
          tag_id: tag.id
        }));
        await supabase.from('tour_tags').insert(tourTagInserts);
        console.log(`✅ Linked ${tourTagInserts.length} tags to tour`);
      }
    }

    // 3. Save normalized structure: tour_days → tour_blocks → tour_items
    let totalItemsSaved = 0;
    const locationIdMap = new Map(); // Map item title+address to location_id
    
    // Pre-populate locationIdMap with saved locations
    for (const locationId of locationsToSave) {
      const { data: location } = await supabase
        .from('locations')
        .select('id, name, address')
        .eq('id', locationId)
        .single();
      
      if (location) {
        const key = `${location.name}|${location.address}`;
        locationIdMap.set(key, location.id);
      }
    }

    if (daily_plan && Array.isArray(daily_plan)) {
      for (let dayIndex = 0; dayIndex < daily_plan.length; dayIndex++) {
        const day = daily_plan[dayIndex];
        
        // Create tour_day
        const { data: tourDay, error: dayError } = await supabase
          .from('tour_days')
          .insert({
            tour_id: tour.id,
            day_number: day.day || dayIndex + 1,
            title: day.title || null,
            date_hint: day.date || null
          })
          .select()
          .single();
        
        if (dayError || !tourDay) {
          console.error(`Error creating tour_day ${dayIndex}:`, dayError);
          continue;
        }
        
        // Process blocks
        if (day.blocks && Array.isArray(day.blocks)) {
          for (let blockIndex = 0; blockIndex < day.blocks.length; blockIndex++) {
            const block = day.blocks[blockIndex];
            
            // Parse time range (e.g., "09:00 - 12:00")
            const timeMatch = block.time?.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
            const startTime = timeMatch ? timeMatch[1] : null;
            const endTime = timeMatch ? timeMatch[2] : null;
            
            // Create tour_block
            const { data: tourBlock, error: blockError } = await supabase
              .from('tour_blocks')
              .insert({
                tour_day_id: tourDay.id,
                start_time: startTime,
                end_time: endTime,
                title: block.title || null
              })
              .select()
              .single();
            
            if (blockError || !tourBlock) {
              console.error(`Error creating tour_block ${blockIndex}:`, blockError);
              continue;
            }
            
            // Process items
            if (block.items && Array.isArray(block.items)) {
              for (let itemIndex = 0; itemIndex < block.items.length; itemIndex++) {
                const item = block.items[itemIndex];
                
                // Find location_id for this item
                let locationId = null;
                if (item.title && item.address) {
                  const key = `${item.title}|${item.address}`;
                  locationId = locationIdMap.get(key);
                  
                  // If not found, try to find in database
                  if (!locationId) {
                    const { data: existingLocation } = await supabase
                      .from('locations')
                      .select('id')
                      .eq('name', item.title)
                      .eq('city_id', cityId)
                      .limit(1)
                      .single();
                    
                    if (existingLocation) {
                      locationId = existingLocation.id;
                      locationIdMap.set(key, locationId);
                    }
                  }
                }
                
                // Create tour_item
                const { data: tourItem, error: itemError } = await supabase
                  .from('tour_items')
                  .insert({
                    tour_block_id: tourBlock.id,
                    location_id: locationId, // FK to locations!
                    custom_title: item.title || null,
                    custom_description: item.why || item.description || null,
                    custom_recommendations: item.tips || item.recommendations || null,
                    order_index: itemIndex,
                    duration_minutes: item.duration || null,
                    approx_cost: item.cost || null,
                    notes: item.notes || null
                  })
                  .select()
                  .single();
                
                if (!itemError && tourItem) {
                  totalItemsSaved++;
                } else {
                  console.error(`Error creating tour_item ${itemIndex}:`, itemError);
                }
              }
            }
          }
        }
      }
    }

    console.log(`✅ Tour structure saved: ${totalItemsSaved} items, ${locationsToSave.length} locations`);

    return res.status(201).json({
      success: true,
      tour: {
        ...tour,
        // Include legacy daily_plan for backward compatibility
        daily_plan: daily_plan || []
      },
      locationsSaved: locationsToSave.length,
      itemsSaved: totalItemsSaved,
      message: `Tour created successfully. ${locationsToSave.length} location(s) and ${totalItemsSaved} item(s) saved to database.`
    });

  } catch (error) {
    console.error('❌ Error creating tour:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create tour',
      message: error.message
    });
  }
}

