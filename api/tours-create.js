/**
 * Tours Create API - Create new tour and save locations to database
 * Serverless function to create tours and extract/save locations
 */

import { supabase } from '../database/db.js';
import { getOrCreateCity } from '../database/services/citiesService.js';

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

    // Save tour to database
    // First, get one existing tour to see what columns exist
    const sampleResult = await supabase
      .from('tours')
      .select('*')
      .limit(1);
    
    // Determine which column to use for creator
    let creatorColumn = null;
    if (sampleResult.data && sampleResult.data.length > 0) {
      const sampleTour = sampleResult.data[0];
      // Check which column exists
      if (sampleTour.creator_id !== undefined) {
        creatorColumn = 'creator_id';
      } else if (sampleTour.user_id !== undefined) {
        creatorColumn = 'user_id';
      } else if (sampleTour.created_by !== undefined) {
        creatorColumn = 'created_by';
      }
    }
    
    // If no sample tour, try creator_id as default
    if (!creatorColumn) {
      creatorColumn = 'creator_id';
    }
    
    const baseTourData = {
      country: country || null,
      city_id: cityId,
      title,
      description: description || null,
      daily_plan: daily_plan || [],
      tags: tags || [],
      meta: meta || {},
      verified: false, // Needs admin verification
      created_at: new Date().toISOString()
    };
    
    // Insert tour with the correct creator column
    const result = await supabase
      .from('tours')
      .insert({ ...baseTourData, [creatorColumn]: userId })
      .select()
      .single();
    
    const tour = result.data;
    const tourError = result.error;

    if (tourError) {
      console.error('Error creating tour:', tourError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create tour',
        message: tourError.message
      });
    }

    console.log(`✅ Tour created: ${tour.id}, Locations saved: ${locationsToSave.length}`);

    return res.status(201).json({
      success: true,
      tour,
      locationsSaved: locationsToSave.length,
      message: `Tour created successfully. ${locationsToSave.length} location(s) saved to database.`
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

