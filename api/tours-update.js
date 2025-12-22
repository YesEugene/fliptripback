/**
 * Tours Update API - Update existing tour
 * Serverless function to update tours (save to PostgreSQL)
 * 
 * According to plan:
 * - Tours are permanent entities stored in PostgreSQL (tours → tour_days → tour_blocks → tour_items)
 * - Updates normalized structure
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
      .single();
    if (existing) return existing.id;
    const { data: newCity } = await supabase
      .from('cities')
      .insert({ name: cityName, country: countryName })
      .select('id')
      .single();
    return newCity?.id || null;
  } catch (err) {
    console.error('Error in fallback getOrCreateCity:', err);
    return null;
  }
}

export default async function handler(req, res) {
  // CRITICAL: This endpoint MUST be accessible at /api/tours-update
  // If you see 404, check Vercel deployment logs
  
  // Log request IMMEDIATELY - this helps verify endpoint is being called
  console.log(`🚀 tours-update handler called: ${req.method} ${req.url}`);
  console.log(`🚀 Query:`, req.query);
  console.log(`🚀 Has auth header:`, !!req.headers.authorization);
  
  // Early return test - if this doesn't work, endpoint isn't being called
  if (req.method === 'GET' && req.query.test === 'true') {
    console.log(`✅ Test endpoint called successfully`);
    return res.status(200).json({ 
      success: true, 
      message: 'tours-update endpoint is working!',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  }
  
  // CORS headers - устанавливаем ПЕРВЫМИ (как в admin-locations.js)
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

  // Handle DELETE method for tour deletion
  if (req.method === 'DELETE') {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Tour ID is required' });
    }

    try {
      // Get user from token
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Use same token decoding as auth-me.js
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      let userId = null;
      
      try {
        // Decode token (simple base64, same as auth-me.js)
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || payload.sub;
      } catch (e) {
        console.error('Token decode error:', e);
        console.error('Token (first 20 chars):', cleanToken.substring(0, 20));
        return res.status(401).json({ success: false, error: 'Invalid token', details: e.message });
      }

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID not found in token' });
      }

      // Check if tour exists and belongs to user
      console.log(`🔍 DELETE: Checking tour ${id} for userId ${userId}`);
      // Use select('*') to get all columns, then check which owner column exists
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (tourError) {
        console.error(`❌ DELETE: Tour check error:`, tourError);
        return res.status(404).json({ 
          success: false, 
          message: 'Tour not found',
          details: tourError.message,
          tourId: id
        });
      }

      if (!tour) {
        console.error(`❌ DELETE: Tour not found: ${id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Tour not found',
          tourId: id
        });
      }

      console.log(`✅ DELETE: Tour found:`, {
        id: tour.id,
        guide_id: tour.guide_id,
        creator_id: tour.creator_id,
        user_id: tour.user_id,
        created_by: tour.created_by
      });

      // Check ownership (try different column names)
      const ownerId = tour.guide_id || tour.creator_id || tour.user_id || tour.created_by;
      console.log(`🔐 DELETE: Ownership check: ownerId=${ownerId}, userId=${userId}, match=${ownerId === userId}`);
      if (ownerId !== userId) {
        console.warn(`⚠️ DELETE: Ownership mismatch: ownerId=${ownerId}, userId=${userId}`);
        return res.status(403).json({ 
          success: false, 
          message: 'You can only delete your own tours',
          ownerId,
          userId
        });
      }

      // Delete tour (cascade will handle related records)
      const { error: deleteError } = await supabase
        .from('tours')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Delete tour error:', deleteError);
        return res.status(500).json({ success: false, message: deleteError.message });
      }

      return res.status(200).json({ success: true, message: 'Tour deleted successfully' });
    } catch (error) {
      console.error('Delete tour error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Handle PUT and PATCH for tour updates
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    console.log(`⚠️ tours-update: Method ${req.method} not allowed (expected PUT or PATCH)`);
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed',
      allowedMethods: ['PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      receivedMethod: req.method
    });
  }
  
  console.log(`✅ tours-update: Processing ${req.method} request for tour ID: ${req.query.id}`);

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Get tour ID from query
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Tour ID is required'
      });
    }

    // Get user from token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Extract user ID from token (same as auth-me.js)
    let userId = null;
    try {
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      try {
        // Decode token (simple base64, same as auth-me.js)
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || payload.sub;
        console.log(`✅ Extracted userId from token: ${userId}`);
      } catch (e) {
        console.error('Token decode error (base64), trying Supabase auth:', e.message);
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

    // Verify user owns the tour
    console.log(`🔍 Checking tour ownership for tour ID: ${id}, userId: ${userId}`);
    // Use select('*') to get all columns, then check which owner column exists
    // Also get current status to protect approved tours
    const { data: existingTour, error: tourCheckError } = await supabase
      .from('tours')
      .select('*, status')
      .eq('id', id)
      .maybeSingle();

    if (tourCheckError) {
      console.error(`❌ Tour check error:`, tourCheckError);
      return res.status(404).json({
        success: false,
        error: 'Tour not found',
        details: tourCheckError.message,
        tourId: id
      });
    }

    if (!existingTour) {
      console.error(`❌ Tour not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Tour not found',
        tourId: id
      });
    }

    console.log(`✅ Tour found:`, {
      id: existingTour.id,
      guide_id: existingTour.guide_id,
      creator_id: existingTour.creator_id,
      user_id: existingTour.user_id,
      created_by: existingTour.created_by
    });

    // Check ownership - use guide_id if available, otherwise try other columns
    let ownerId = null;
    if (existingTour.guide_id !== undefined) {
      ownerId = existingTour.guide_id;
    } else if (existingTour.creator_id !== undefined) {
      ownerId = existingTour.creator_id;
    } else if (existingTour.user_id !== undefined) {
      ownerId = existingTour.user_id;
    } else if (existingTour.created_by !== undefined) {
      ownerId = existingTour.created_by;
    }
    console.log(`🔐 Ownership check: ownerId=${ownerId}, userId=${userId}, match=${ownerId === userId}`);
    if (ownerId !== userId) {
      console.warn(`⚠️ Ownership mismatch: ownerId=${ownerId}, userId=${userId}`);
      return res.status(403).json({
        success: false,
        error: 'You can only update your own tours',
        ownerId,
        userId
      });
    }

    const tourData = req.body;
    let { country, city, title, description, daily_plan, tags, meta, status, saveAsDraft } = tourData;
    // status can be: 'draft', 'pending', 'approved', 'rejected'
    // If not provided, keep existing status or default to 'draft'
    // country is optional - can be empty or undefined
    // saveAsDraft: if true, save to draft_data without changing main fields or status

    if (!city || !title) {
      return res.status(400).json({
        success: false,
        error: 'City and title are required'
      });
    }

    // Get or create city
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

    // Determine which column to use for guide_id
    let userColumnName = 'guide_id';
    if (existingTour.creator_id) userColumnName = 'creator_id';
    else if (existingTour.user_id) userColumnName = 'user_id';
    else if (existingTour.created_by) userColumnName = 'created_by';

    // Calculate duration
    const totalDays = daily_plan?.length || 0;
    let durationType = 'hours';
    let durationValue = 6;

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

    // Extract format and pricing
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

    // Update main tour record
    const updateData = {
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
      preview_media_type: previewMediaType
    };

    // Add default_group_size if provided
    const defaultGroupSize = tourData.price?.defaultGroupSize || tourData.defaultGroupSize || null;
    if (format === 'with_guide' && defaultGroupSize) {
      updateData.default_group_size = defaultGroupSize;
    }
    
    // Add With Guide data to JSONB field (if column exists, will be handled gracefully)
    // Store in a JSONB field for flexible storage
    if (meetingPoint || meetingTime || availableDates || additionalOptions) {
      const extraData = {};
      if (meetingPoint) extraData.meeting_point = meetingPoint;
      if (meetingTime) extraData.meeting_time = meetingTime;
      if (availableDates) extraData.available_dates = availableDates;
      if (additionalOptions) extraData.additional_options = additionalOptions;
      
      // Try to get existing meta data before update
      const { data: existingTour } = await supabase
        .from('tours')
        .select('meta')
        .eq('id', id)
        .maybeSingle();
      
      const existingMeta = existingTour?.meta || {};
      updateData.meta = { ...existingMeta, ...extraData };
    }
    
    // Handle draft auto-save: save to draft_data without changing main fields or status
    if (saveAsDraft === true) {
      console.log('💾 Auto-saving to draft_data (not changing main fields or status)');
      
      // Prepare draft data (all tour data except status)
      const draftData = {
        country,
        city,
        title,
        description,
        daily_plan,
        tags,
        meta,
        format,
        price: {
          pdfPrice: pricePdf,
          guidedPrice: priceGuided,
          currency: tourData.price?.currency || 'USD',
          meetingPoint,
          meetingTime,
          availableDates,
          defaultGroupSize
        },
        preview: previewMediaUrl,
        previewType: previewMediaType,
        additionalOptions,
        updated_at: new Date().toISOString()
      };
      
      // Update only draft_data, keep everything else unchanged
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .update({ draft_data: draftData })
        .eq('id', id)
        .select()
        .single();
      
      if (tourError) {
        console.error('❌ Error saving draft:', tourError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save draft',
          details: tourError.message
        });
      }
      
      console.log('✅ Draft saved successfully');
      return res.status(200).json({
        success: true,
        tour: tour,
        message: 'Draft saved successfully',
        isDraft: true
      });
    }
    
    // Handle Submit for Moderation: copy draft_data to main fields and set status to pending
    if (status === 'pending') {
      console.log('📤 Submitting for moderation: copying draft_data to main fields');
      
      // Get current draft_data if exists
      const { data: currentTour } = await supabase
        .from('tours')
        .select('draft_data, status')
        .eq('id', id)
        .single();
      
      // If draft_data exists, use it to populate main fields
      if (currentTour?.draft_data) {
        const draft = currentTour.draft_data;
        console.log('📋 Found draft_data, using it for submission');
        
        // Override updateData with draft_data values
        if (draft.city) {
          // Get or create city from draft
          try {
            const citiesModule = await import('../database/services/citiesService.js');
            if (citiesModule.getOrCreateCity) {
              cityId = await citiesModule.getOrCreateCity(draft.city, draft.country);
            } else {
              cityId = await getOrCreateCityFallback(draft.city, draft.country);
            }
          } catch (e) {
            cityId = await getOrCreateCityFallback(draft.city, draft.country);
          }
          updateData.city_id = cityId;
        }
        if (draft.title) updateData.title = draft.title;
        if (draft.description !== undefined) updateData.description = draft.description;
        if (draft.format) {
          const draftFormat = draft.format === 'with_guide' || draft.format === 'guided' ? 'with_guide' : 'self_guided';
          updateData.default_format = draftFormat;
        }
        if (draft.price) {
          if (draft.price.pdfPrice !== undefined) updateData.price_pdf = draft.price.pdfPrice;
          if (draft.price.guidedPrice !== undefined) updateData.price_guided = draft.price.guidedPrice;
          if (draft.price.currency) updateData.currency = draft.price.currency;
          if (draft.price.defaultGroupSize && updateData.default_format === 'with_guide') {
            updateData.default_group_size = draft.price.defaultGroupSize;
          }
        }
        if (draft.preview) updateData.preview_media_url = draft.preview;
        if (draft.previewType) updateData.preview_media_type = draft.previewType;
        
        // Recalculate duration from draft daily_plan
        if (draft.daily_plan && Array.isArray(draft.daily_plan)) {
          const totalDays = draft.daily_plan.length;
          if (totalDays > 1) {
            updateData.duration_type = 'days';
            updateData.duration_value = totalDays;
          } else if (totalDays === 1 && draft.daily_plan[0]?.blocks) {
            // Calculate hours from first day
            const firstDay = draft.daily_plan[0];
            const blocks = firstDay.blocks || [];
            if (blocks.length > 0) {
              let earliestStart = null;
              let latestEnd = null;
              blocks.forEach(block => {
                if (block.time) {
                  const timeMatch = block.time.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*-\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
                  if (timeMatch) {
                    const startTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                    const endTime = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
                    if (earliestStart === null || startTime < earliestStart) earliestStart = startTime;
                    if (latestEnd === null || endTime > latestEnd) latestEnd = endTime;
                  }
                }
              });
              if (earliestStart !== null && latestEnd !== null) {
                const durationHours = Math.ceil((latestEnd - earliestStart) / 60);
                updateData.duration_value = Math.max(1, durationHours);
              }
            }
          }
        }
        
        // Update meta with draft data
        if (draft.price) {
          const extraData = {};
          if (draft.price.meetingPoint) extraData.meeting_point = draft.price.meetingPoint;
          if (draft.price.meetingTime) extraData.meeting_time = draft.price.meetingTime;
          if (draft.price.availableDates) extraData.available_dates = draft.price.availableDates;
          if (draft.additionalOptions) extraData.additional_options = draft.additionalOptions;
          
          const existingMeta = currentTour?.meta || {};
          updateData.meta = { ...existingMeta, ...extraData };
        }
        
        // Use draft daily_plan for updating tour_days
        daily_plan = draft.daily_plan;
      }
      
      // Set status to pending and clear draft_data
      updateData.status = 'pending';
      updateData.draft_data = null; // Clear draft after submission
    }
    
    // Add status if provided (for manual status changes)
    // IMPORTANT: Don't change status from 'approved' to 'draft' - this would hide the tour from site
    // If tour is approved, only allow changing to 'pending' (for moderation) or keep it 'approved'
    if (status && ['draft', 'pending', 'approved', 'rejected'].includes(status) && status !== 'pending') {
      const currentStatus = existingTour?.status;
      
      // Protect approved tours: don't allow changing to draft
      if (currentStatus === 'approved' && status === 'draft') {
        console.warn('⚠️ Attempted to change approved tour to draft - ignoring status change');
        // Don't change status - keep it approved
        // If user wants to save draft, they should use saveAsDraft: true
      } else {
        updateData.status = status;
        // If status is 'approved', also set is_published = true
        if (status === 'approved') {
          updateData.is_published = true;
        }
      }
    }

    // Add country if column exists (handle gracefully)
    if (country) {
      updateData.country = country;
    }

    console.log(`💾 Updating tour ${id} with data:`, Object.keys(updateData));
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    console.log(`📊 Update result:`, { 
      hasData: !!tour, 
      hasError: !!tourError,
      errorMessage: tourError?.message,
      errorCode: tourError?.code
    });

    if (tourError) {
      // If country column error, retry without it
      if (tourError.message && tourError.message.includes("'country' column")) {
        delete updateData.country;
        const { data: tourRetry, error: tourErrorRetry } = await supabase
          .from('tours')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (tourErrorRetry) {
          return res.status(500).json({
            success: false,
            error: 'Failed to update tour',
            message: tourErrorRetry.message
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to update tour',
          message: tourError.message
        });
      }
    }

    // Delete existing normalized structure
    await supabase.from('tour_days').delete().eq('tour_id', id);

    // Recreate normalized structure: tour_days → tour_blocks → tour_items
    let totalItemsSaved = 0;
    const locationsToSave = [];
    const locationIdMap = new Map();

    // Extract and save locations from daily_plan (same logic as tours-create.js)
    if (daily_plan && Array.isArray(daily_plan)) {
      for (const day of daily_plan) {
        if (day.blocks && Array.isArray(day.blocks)) {
          for (const block of day.blocks) {
            if (block.items && Array.isArray(block.items)) {
              for (const item of block.items) {
                if (item.title) {
                  const { data: existingLocation } = await supabase
                    .from('locations')
                    .select('id')
                    .eq('name', item.title)
                    .eq('city_id', cityId)
                    .maybeSingle();

                  if (!existingLocation) {
                    const locationData = {
                      name: item.title,
                      city_id: cityId,
                      address: item.address,
                      category: item.category || null,
                      description: item.why || item.description || null,
                      recommendations: item.tips || item.recommendations || null,
                      // verified: false - removed, column doesn't exist in locations schema
                      source: 'guide',
                      google_place_id: item.google_place_id || null,
                      website: item.website || null,
                      phone: item.phone || null,
                      booking_url: item.booking_url || null,
                      price_level: item.price_level !== undefined ? parseInt(item.price_level) : 2
                    };

                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (userId && uuidRegex.test(userId)) {
                      locationData.created_by = userId;
                      locationData.updated_by = userId;
                    }

                    const { data: newLocation } = await supabase
                      .from('locations')
                      .insert(locationData)
                      .select()
                      .single();

                    if (newLocation) {
                      locationsToSave.push(newLocation.id);
                      const key = newLocation.address ? `${newLocation.name}|${newLocation.address}` : newLocation.name;
                      locationIdMap.set(key, newLocation.id);
                      
                      // Save location interests if provided
                      if (item.interest_ids && Array.isArray(item.interest_ids) && item.interest_ids.length > 0) {
                        const interestInserts = item.interest_ids.map(interestId => ({
                          location_id: newLocation.id,
                          interest_id: interestId
                        }));
                        
                        if (interestInserts.length > 0) {
                          await supabase
                            .from('location_interests')
                            .insert(interestInserts);
                        }
                      }
                    }
                  } else {
                    locationsToSave.push(existingLocation.id);
                    const key = item.address ? `${item.title}|${item.address}` : item.title;
                    locationIdMap.set(key, existingLocation.id);
                    
                    // Update existing location with new data if provided
                    if (item.description || item.recommendations || item.price_level !== undefined) {
                      const updateData = {};
                      if (item.why || item.description) {
                        updateData.description = item.why || item.description;
                      }
                      if (item.tips || item.recommendations) {
                        updateData.recommendations = item.tips || item.recommendations;
                      }
                      if (item.price_level !== undefined) {
                        updateData.price_level = parseInt(item.price_level);
                      }
                      
                      if (Object.keys(updateData).length > 0) {
                        await supabase
                          .from('locations')
                          .update(updateData)
                          .eq('id', existingLocation.id);
                      }
                    }
                    
                    // Update location interests if provided
                    if (item.interest_ids && Array.isArray(item.interest_ids) && item.interest_ids.length > 0) {
                      // Delete existing interests for this location
                      await supabase
                        .from('location_interests')
                        .delete()
                        .eq('location_id', existingLocation.id);
                      
                      // Insert new interests
                      const interestInserts = item.interest_ids.map(interestId => ({
                        location_id: existingLocation.id,
                        interest_id: interestId
                      }));
                      
                      if (interestInserts.length > 0) {
                        await supabase
                          .from('location_interests')
                          .insert(interestInserts);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

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

    // Recreate tour_days, tour_blocks, tour_items
    if (daily_plan && Array.isArray(daily_plan)) {
      for (let dayIndex = 0; dayIndex < daily_plan.length; dayIndex++) {
        const day = daily_plan[dayIndex];
        
        const { data: tourDay } = await supabase
          .from('tour_days')
          .insert({
            tour_id: id,
            day_number: day.day || dayIndex + 1,
            title: day.title || null,
            date_hint: day.date || null
          })
          .select()
          .single();
        
        if (tourDay && day.blocks && Array.isArray(day.blocks)) {
          for (let blockIndex = 0; blockIndex < day.blocks.length; blockIndex++) {
            const block = day.blocks[blockIndex];
            
            // Parse time range (e.g., "09:00 - 12:00" or "9:00 - 12:00" or "09:00:00 - 12:00:00")
            // Support both HH:MM and H:MM formats, and handle seconds if present
            const timeMatch = block.time?.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*-\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
            const startTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null;
            const endTime = timeMatch ? `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}` : null;
            
            const { data: tourBlock } = await supabase
              .from('tour_blocks')
              .insert({
                tour_day_id: tourDay.id,
                start_time: startTime,
                end_time: endTime,
                title: block.title || null
              })
              .select()
              .single();
            
            if (tourBlock && block.items && Array.isArray(block.items)) {
              for (let itemIndex = 0; itemIndex < block.items.length; itemIndex++) {
                const item = block.items[itemIndex];
                
                let locationId = null;
                
                // Try to find location by title and address (if both exist)
                if (item.title) {
                  const key = item.address ? `${item.title}|${item.address}` : item.title;
                  locationId = locationIdMap.get(key);
                  
                  if (!locationId) {
                    // Try to find existing location by name and city
                    const { data: existingLocation } = await supabase
                      .from('locations')
                      .select('id')
                      .eq('name', item.title)
                      .eq('city_id', cityId)
                      .limit(1)
                      .maybeSingle();
                    
                    if (existingLocation) {
                      locationId = existingLocation.id;
                      locationIdMap.set(key, locationId);
                    } else {
                      console.log(`⚠️ Location not found for item: ${item.title} in city ${cityId}`);
                    }
                  }
                } else {
                  console.log('⚠️ Item has no title:', item);
                }
                
                const { data: tourItem } = await supabase
                  .from('tour_items')
                  .insert({
                    tour_block_id: tourBlock.id,
                    location_id: locationId,
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
                
                if (tourItem) {
                  totalItemsSaved++;
                }
              }
            }
          }
        }
      }
    }

    // Update tags
    if (tags && Array.isArray(tags)) {
      await supabase.from('tour_tags').delete().eq('tour_id', id);
      if (tags.length > 0) {
        const { data: tagsData } = await supabase
          .from('tags')
          .select('id, name')
          .in('name', tags);
        
        if (tagsData && tagsData.length > 0) {
          const tourTagInserts = tagsData.map(tag => ({
            tour_id: id,
            tag_id: tag.id
          }));
          await supabase.from('tour_tags').insert(tourTagInserts);
        }
      }
    }

    console.log(`✅ Tour ${id} updated successfully`);
    console.log(`📊 Saved ${totalItemsSaved} items from daily_plan`);

    return res.status(200).json({
      success: true,
      tour: tour,
      message: 'Tour updated successfully',
      itemsSaved: totalItemsSaved
    });

  } catch (error) {
    console.error('❌ Update tour error:', error);
    // Ensure CORS headers are set even on error
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return res.status(500).json({
      success: false,
      error: 'Failed to update tour',
      message: error.message
    });
  }
}

