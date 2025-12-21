/**
 * Recalculate Duration for Existing Tours
 * 
 * This endpoint recalculates duration_type and duration_value for all existing tours
 * based on the new logic:
 * - 1 day: calculate hours from first location start to last location end
 * - 2+ days: use number of days
 * 
 * IMPORTANT: This only updates duration fields, doesn't modify tour structure
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

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

    console.log('🔄 Starting duration recalculation for all tours...');

    // Get all tours with their tour_days structure
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select(`
        id,
        title,
        tour_days(
          id,
          day_number,
          tour_blocks(
            id,
            start_time,
            end_time
          )
        )
      `);

    if (toursError) {
      console.error('❌ Error fetching tours:', toursError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tours',
        message: toursError.message
      });
    }

    if (!tours || tours.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No tours found',
        updated: 0
      });
    }

    console.log(`📊 Found ${tours.length} tours to process`);

    const results = {
      total: tours.length,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process each tour
    for (const tour of tours) {
      try {
        const tourDays = tour.tour_days || [];
        const totalDays = tourDays.length;

        let durationType = 'hours';
        let durationValue = 6; // Default

        if (totalDays > 1) {
          // Multiple days: use number of days
          durationType = 'days';
          durationValue = totalDays;
        } else if (totalDays === 1 && tourDays[0]?.tour_blocks) {
          // Single day: calculate hours from first location start to last location end
          const blocks = tourDays[0].tour_blocks || [];
          
          if (blocks.length > 0) {
            // Find earliest start_time and latest end_time
            let earliestStart = null;
            let latestEnd = null;
            
            blocks.forEach(block => {
              if (block.start_time && block.end_time) {
                // Parse time (format: "HH:MM" or "HH:MM:SS")
                const startMatch = block.start_time.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
                const endMatch = block.end_time.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
                
                if (startMatch && endMatch) {
                  const startHours = parseInt(startMatch[1]);
                  const startMinutes = parseInt(startMatch[2]);
                  const endHours = parseInt(endMatch[1]);
                  const endMinutes = parseInt(endMatch[2]);
                  
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

        // Update tour duration
        const { error: updateError } = await supabase
          .from('tours')
          .update({
            duration_type: durationType,
            duration_value: durationValue
          })
          .eq('id', tour.id);

        if (updateError) {
          console.error(`❌ Error updating tour ${tour.id}:`, updateError);
          results.errors.push({
            tourId: tour.id,
            title: tour.title,
            error: updateError.message
          });
          results.skipped++;
        } else {
          console.log(`✅ Updated tour ${tour.id} (${tour.title}): ${durationValue} ${durationType}`);
          results.updated++;
        }
      } catch (err) {
        console.error(`❌ Error processing tour ${tour.id}:`, err);
        results.errors.push({
          tourId: tour.id,
          title: tour.title,
          error: err.message
        });
        results.skipped++;
      }
    }

    console.log(`✅ Duration recalculation complete: ${results.updated} updated, ${results.skipped} skipped`);

    return res.status(200).json({
      success: true,
      message: `Recalculated duration for ${results.updated} tours`,
      results: results
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}



