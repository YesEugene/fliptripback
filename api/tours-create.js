/**
 * Tours Create API - Create new tour and save to PostgreSQL database
 * Serverless function to create tours (save to PostgreSQL) and extract/save locations (to PostgreSQL)
 * 
 * According to plan:
 * - Tours are permanent entities stored in PostgreSQL (tours → tour_days → tour_blocks → tour_items)
 * - Locations are permanent entities stored in PostgreSQL (locations table)
 * - Redis is only for temporary data (itineraries, sessions)
 */

import { supabase } from '../database/db.js';

// Fallback function for getOrCreateCity (in case import fails)
async function getOrCreateCityFallback(cityName, countryName) {
  if (!supabase || !cityName) return null;
  try {
    const { data: existing } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName)
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;
    // Create new city (country field doesn't exist in cities table)
    const { data: newCity, error: insertError } = await supabase
      .from('cities')
      .insert({ name: cityName })
      .select('id')
      .single();
    
    if (insertError) {
      console.error('❌ Error creating city:', insertError);
      return null;
    }
    
    return newCity?.id || null;
  } catch (err) {
    console.error('Error in fallback getOrCreateCity:', err);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers - устанавливаем ПЕРВЫМИ (как в admin-locations.js)
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'https://fliptrip-clean-frontend.vercel.app',
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

    console.log('👤 User data from DB:', { userId, userData, userError });

    if (userError || !userData) {
      console.error('❌ User not found or error:', userError);
      return res.status(403).json({
        success: false,
        error: 'User not found or invalid token',
        details: userError?.message
      });
    }

    // Allow both 'creator' and 'guide' roles (they are the same)
    if (userData.role !== 'creator' && userData.role !== 'guide') {
      console.error('❌ Invalid role:', userData.role);
      return res.status(403).json({
        success: false,
        error: 'Only creators/guides can create tours',
        userRole: userData.role
      });
    }

    const tourData = req.body;
    const { country, city, title, description, daily_plan, tags, meta } = tourData;
    // country is optional - can be empty or undefined

    console.log('📥 Tour creation request:', {
      userId,
      hasCountry: !!country,
      hasCity: !!city,
      hasTitle: !!title,
      hasDescription: !!description,
      hasDailyPlan: !!daily_plan,
      dailyPlanLength: daily_plan?.length || 0,
      hasTags: !!tags,
      tagsLength: tags?.length || 0
    });

    if (!city || !title) {
      return res.status(400).json({
        success: false,
        error: 'City and title are required'
      });
    }

    // Get or create city (try import first, fallback to inline function)
    let cityId = null;
    try {
      const citiesModule = await import('../database/services/citiesService.js');
      if (citiesModule.getOrCreateCity) {
        cityId = await citiesModule.getOrCreateCity(city, country);
      } else {
        cityId = await getOrCreateCityFallback(city, country);
      }
    } catch (e) {
      console.warn('⚠️ Could not import citiesService, using fallback:', e.message);
      cityId = await getOrCreateCityFallback(city, country);
    }
    console.log('🏙️ City ID:', cityId);

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
                    // Create new location (without tags - they go to separate table)
                    const locationData = {
                      name: item.title,
                      city_id: cityId,
                      address: item.address,
                      category: item.category || null,
                      description: item.why || item.description || null,
                      recommendations: item.tips || item.recommendations || null,
                      // verified: false - removed, column doesn't exist in locations schema
                      source: 'guide', // Локации из туров создаются гидом
                      google_place_id: item.google_place_id || null,
                      website: item.website || null,
                      phone: item.phone || null,
                      booking_url: item.booking_url || null,
                      price_level: item.price_level !== undefined ? parseInt(item.price_level) : 2
                    };

                    // Only add user fields if userId is valid UUID
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (userId && uuidRegex.test(userId)) {
                      locationData.created_by = userId;
                      locationData.updated_by = userId;
                    } else {
                      console.warn('⚠️ Skipping user fields for location - invalid UUID:', userId);
                    }

                    const { data: newLocation, error: locationError } = await supabase
                      .from('locations')
                      .insert(locationData)
                      .select()
                      .single();

                    if (!locationError && newLocation) {
                      locationsToSave.push(newLocation.id);

                      // Save tags if provided (into location_tags table)
                      if (tags && Array.isArray(tags) && tags.length > 0) {
                        // Get tag IDs by names
                        const { data: tagsData } = await supabase
                          .from('tags')
                          .select('id, name')
                          .in('name', tags);
                        
                        if (tagsData && tagsData.length > 0) {
                          const tagInserts = tagsData.map(tag => ({
                            location_id: newLocation.id,
                            tag_id: tag.id
                          }));
                          await supabase.from('location_tags').insert(tagInserts);
                        }
                      }

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
      // Multiple days: show number of days
      durationType = 'days';
      durationValue = totalDays;
    } else if (totalDays === 1 && daily_plan && daily_plan[0]?.blocks) {
      // Single day: calculate hours from first location start to last location end
      const firstDay = daily_plan[0];
      const blocks = firstDay.blocks || [];
      
      if (blocks.length > 0) {
        // Find earliest start_time and latest end_time
        let earliestStart = null;
        let latestEnd = null;
        
        blocks.forEach(block => {
          if (block.time) {
            // Parse time range (e.g., "09:00 - 12:00" or "09:00:00 - 12:00:00")
            const timeMatch = block.time.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*-\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
            if (timeMatch) {
              const startHours = parseInt(timeMatch[1]);
              const startMinutes = parseInt(timeMatch[2]);
              const endHours = parseInt(timeMatch[3]);
              const endMinutes = parseInt(timeMatch[4]);
              
              const startTime = startHours * 60 + startMinutes; // Convert to minutes
              const endTime = endHours * 60 + endMinutes;
              
              if (earliestStart === null || startTime < earliestStart) {
                earliestStart = startTime;
              }
              if (latestEnd === null || endTime > latestEnd) {
                latestEnd = endTime;
              }
            }
          }
        });
        
        if (earliestStart !== null && latestEnd !== null) {
          // Calculate duration in hours (round up to nearest hour)
          const durationMinutes = latestEnd - earliestStart;
          const durationHours = Math.ceil(durationMinutes / 60);
          durationValue = Math.max(1, durationHours); // At least 1 hour
        } else {
          // Fallback: estimate from number of blocks
          durationValue = Math.max(3, Math.min(blocks.length * 3, 12));
        }
      }
    }
    
    // Extract format and pricing from tourData
    // Ensure format is one of the allowed values (self_guided, with_guide)
    // Frontend sends 'guided' or 'self-guided', backend expects 'with_guide' or 'self_guided'
    const rawFormat = tourData.format || 'self_guided';
    let format = 'self_guided'; // Default
    if (rawFormat === 'with_guide' || rawFormat === 'guided') {
      format = 'with_guide';
    } else if (rawFormat === 'self_guided' || rawFormat === 'self-guided') {
      format = 'self_guided';
    }
    // Also check withGuide flag if format is not clear
    if (tourData.withGuide && format === 'self_guided') {
      format = 'with_guide';
    }
    console.log(`📋 Tour format: ${format} (from: ${rawFormat}, withGuide: ${tourData.withGuide})`);
    const pricePdf = tourData.price?.pdfPrice || 16.00;
    const priceGuided = tourData.price?.guidedPrice || null;
    const previewMediaUrl = tourData.preview || null;
    const previewMediaType = tourData.previewType || 'image';
    
    // Extract With Guide data
    const meetingPoint = tourData.price?.meetingPoint || null;
    const meetingTime = tourData.price?.meetingTime || null;
    const availableDates = Array.isArray(tourData.price?.availableDates) ? tourData.price.availableDates : null;
    
    // Extract Additional Options
    const additionalOptions = tourData.additionalOptions || null;
    
    // 1. Create main tour record
    const baseTourData = {
      [userColumnName]: userId,
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
      status: 'draft'
      // verified: false - removed, column doesn't exist in schema
    };
    
    // Add default_group_size if provided
    const defaultGroupSize = tourData.price?.defaultGroupSize || tourData.defaultGroupSize || 10;
    if (format === 'with_guide') {
      baseTourData.default_group_size = defaultGroupSize;
    }

    // Add With Guide data and Additional Options to meta JSONB field (if column exists)
    if (meetingPoint || meetingTime || availableDates || additionalOptions) {
      const extraData = {};
      if (meetingPoint) extraData.meeting_point = meetingPoint;
      if (meetingTime) extraData.meeting_time = meetingTime;
      if (availableDates) extraData.available_dates = availableDates;
      if (additionalOptions) extraData.additional_options = additionalOptions;
      baseTourData.meta = extraData;
    }

    // Add country if provided (column should exist according to schema)
    // If column doesn't exist, Supabase will return error, but we'll handle it gracefully
    if (country) {
      baseTourData.country = country;
    }
    
    console.log('💾 Inserting tour with data:', {
      [userColumnName]: userId,
      country: country || 'NOT SET',
      city_id: cityId,
      title,
      duration_type: durationType,
      duration_value: durationValue,
      hasCountryInData: !!baseTourData.country
    });

    let tour = null; // Declare tour variable
    
    // Try insert without country first if country column might not exist
    let insertData, insertError;
    
    // First attempt: with all data
    const insertResult = await supabase
      .from('tours')
      .insert(baseTourData)
      .select()
      .single();
    
    insertData = insertResult.data;
    insertError = insertResult.error;
    
    // If error is about country column, retry without it
    if (insertError && insertError.message && insertError.message.includes("'country' column")) {
      console.log('⚠️ Country column error, retrying without country...');
      const baseTourDataWithoutCountry = { ...baseTourData };
      delete baseTourDataWithoutCountry.country;
      
      const retryResult = await supabase
        .from('tours')
        .insert(baseTourDataWithoutCountry)
        .select()
        .single();
      
      insertData = retryResult.data;
      insertError = retryResult.error;
    }
    
    if (insertError) {
      console.error('❌ Error creating tour:', insertError);
      console.error('❌ Tour data keys:', Object.keys(baseTourData));
      console.error('❌ Error code:', insertError.code);
      console.error('❌ Error message:', insertError.message);
      
      // Ensure CORS headers before returning error
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      return res.status(500).json({
        success: false,
        error: 'Failed to create tour',
        message: insertError.message,
        details: insertError.code,
        hint: insertError.message.includes("'country' column") 
          ? 'Please run add-country-column.sql migration' 
          : 'Check database schema and tour data'
      });
    }
    
    tour = insertData;
    console.log(`✅ Tour created: ${tour.id}`);

    // Ensure tour variable exists
    if (!tour) {
      return res.status(500).json({
        success: false,
        error: 'Tour creation failed - no tour object'
      });
    }

    // 1.5. Create availability slots if tour has guide and availableDates
    if (format === 'with_guide' && availableDates && Array.isArray(availableDates) && availableDates.length > 0) {
      try {
        const slotsToInsert = availableDates.map(date => ({
          tour_id: tour.id,
          date: date,
          max_group_size: defaultGroupSize,
          is_available: true,
          is_blocked: false
        }));

        const { error: slotsError } = await supabase
          .from('tour_availability_slots')
          .insert(slotsToInsert);

        if (slotsError) {
          console.error('⚠️ Error creating availability slots:', slotsError);
          // Don't fail the tour creation, just log the error
        } else {
          console.log(`✅ Created ${slotsToInsert.length} availability slots for tour`);
        }
      } catch (err) {
        console.error('⚠️ Error creating availability slots:', err);
        // Don't fail the tour creation
      }
    }

    // 2. Save interests if provided
    // tags parameter contains array of interest IDs (UUIDs)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // All tags are interest IDs (UUIDs or numbers)
      // Convert numeric strings to integers if needed
      const tourTagInserts = tags.map(interestId => ({
        tour_id: tour.id,
        tag_id: null, // CRITICAL: Must be null for interests (not-null constraint requires explicit null)
        interest_id: typeof interestId === 'string' && /^\d+$/.test(interestId) ? parseInt(interestId, 10) : interestId
      }));
      
      console.log('💾 Saving interests to tour_tags (create):', tourTagInserts);
      const { data: insertedTags, error: insertError } = await supabase
        .from('tour_tags')
        .insert(tourTagInserts)
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting interests (create):', insertError);
        console.error('❌ Insert error details:', JSON.stringify(insertError, null, 2));
        // Check if error is due to missing interest_id column
        if (insertError.message && insertError.message.includes('interest_id')) {
          console.error('❌ ERROR: interest_id column does not exist in tour_tags table!');
          console.error('❌ Please run the migration: database/add-interest-id-to-tour-tags.sql');
        }
        // Don't throw - continue tour creation even if interests fail
      } else {
        console.log(`✅ Linked ${insertedTags.length} interests to tour:`, insertedTags);
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
    // Ensure CORS headers are set even on error
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create tour',
      message: error.message
    });
  }
}

