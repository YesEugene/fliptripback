/**
 * Guide Availability API - Manage tour availability slots
 * Endpoints for managing date availability for guided tours
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
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

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // GET - Get availability slots for a tour (PUBLIC ACCESS - no auth required)
    if (req.method === 'GET') {
      const { tour_id, date_from, date_to } = req.query;

      if (!tour_id) {
        return res.status(400).json({
          success: false,
          error: 'tour_id is required'
        });
      }

      // Verify user owns the tour
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('guide_id')
        .eq('id', tour_id)
        .single();

      if (tourError || !tour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      // Check if user is the guide (for guide dashboard) or allow public access (for preview)
      // For now, allow public access to availability (can be restricted later)
      
      let query = supabase
        .from('tour_availability_slots')
        .select('*')
        .eq('tour_id', tour_id)
        .gte('date', date_from || new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (date_to) {
        query = query.lte('date', date_to);
      }

      const { data: slots, error } = await query;

      if (error) {
        console.error('Error fetching availability slots:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch availability slots'
        });
      }

      // Calculate available spots for each slot
      const availability = (slots || []).map(slot => ({
        id: slot.id,
        date: slot.date,
        max_group_size: slot.max_group_size,
        booked_spots: slot.booked_spots || 0,
        available_spots: Math.max(0, slot.max_group_size - (slot.booked_spots || 0)),
        is_available: slot.is_available && !slot.is_blocked && (slot.booked_spots || 0) < slot.max_group_size,
        is_blocked: slot.is_blocked,
        custom_price: slot.custom_price,
        notes: slot.notes
      }));

      return res.status(200).json({
        success: true,
        availability
      });
    }

    // Helper function to get authenticated user (for POST/PUT/DELETE)
    const getAuthenticatedUser = async () => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return null;
      }

      let userId = null;
      try {
        const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        try {
          const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
          userId = payload.userId || payload.id || null;
        } catch (e) {
          const { data: { user }, error: authError } = await supabase.auth.getUser(cleanToken);
          if (user) userId = user.id;
        }
      } catch (err) {
        console.error('Auth error:', err);
      }

      return userId;
    };

    // POST - Create or update multiple availability slots (REQUIRES AUTH)
    if (req.method === 'POST') {
      const userId = await getAuthenticatedUser();
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - authentication required'
        });
      }
      const { tour_id, slots, bulk_block } = req.body;

      if (!tour_id) {
        return res.status(400).json({
          success: false,
          error: 'tour_id is required'
        });
      }

      // Verify user owns the tour
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('guide_id, default_group_size')
        .eq('id', tour_id)
        .single();

      if (tourError || !tour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      if (tour.guide_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only manage availability for your own tours'
        });
      }

      // Bulk block dates
      if (bulk_block) {
        const { dates, is_blocked } = bulk_block;
        
        if (!Array.isArray(dates) || dates.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'dates array is required for bulk block'
          });
        }

        const updates = dates.map(date => ({
          tour_id,
          date,
          is_blocked: is_blocked !== false,
          is_available: is_blocked === false
        }));

        const { data: updated, error: updateError } = await supabase
          .from('tour_availability_slots')
          .upsert(updates, {
            onConflict: 'tour_id,date',
            ignoreDuplicates: false
          })
          .select();

        if (updateError) {
          console.error('Error bulk blocking dates:', updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to bulk block dates'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Dates blocked successfully',
          updated_count: updated?.length || 0
        });
      }

      // Create or update slots
      if (!Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'slots array is required'
        });
      }

      const slotsToUpsert = slots.map(slot => ({
        tour_id,
        date: slot.date,
        max_group_size: slot.max_group_size || tour.default_group_size || 10,
        is_available: slot.is_available !== false,
        is_blocked: slot.is_blocked || false,
        custom_price: slot.custom_price || null,
        notes: slot.notes || null
      }));

      const { data: updated, error: upsertError } = await supabase
        .from('tour_availability_slots')
        .upsert(slotsToUpsert, {
          onConflict: 'tour_id,date',
          ignoreDuplicates: false
        })
        .select();

      if (upsertError) {
        console.error('Error upserting availability slots:', upsertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update availability slots'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Availability slots updated',
        updated_count: updated?.length || 0,
        slots: updated
      });
    }

    // PUT - Update a specific availability slot (REQUIRES AUTH)
    if (req.method === 'PUT') {
      const userId = await getAuthenticatedUser();
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - authentication required'
        });
      }

      const { slot_id } = req.query;
      const { max_group_size, is_available, is_blocked, custom_price, notes } = req.body;

      if (!slot_id) {
        return res.status(400).json({
          success: false,
          error: 'slot_id is required'
        });
      }

      // Get slot and verify ownership
      const { data: slot, error: slotError } = await supabase
        .from('tour_availability_slots')
        .select('tour_id, tours!inner(guide_id)')
        .eq('id', slot_id)
        .single();

      if (slotError || !slot) {
        return res.status(404).json({
          success: false,
          error: 'Availability slot not found'
        });
      }

      if (slot.tours.guide_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only update availability for your own tours'
        });
      }

      const updateData = {};
      if (max_group_size !== undefined) updateData.max_group_size = max_group_size;
      if (is_available !== undefined) updateData.is_available = is_available;
      if (is_blocked !== undefined) updateData.is_blocked = is_blocked;
      if (custom_price !== undefined) updateData.custom_price = custom_price;
      if (notes !== undefined) updateData.notes = notes;

      const { data: updated, error: updateError } = await supabase
        .from('tour_availability_slots')
        .update(updateData)
        .eq('id', slot_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating availability slot:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update availability slot'
        });
      }

      return res.status(200).json({
        success: true,
        slot: updated
      });
    }

    // DELETE - Delete (block) an availability slot (REQUIRES AUTH)
    if (req.method === 'DELETE') {
      const userId = await getAuthenticatedUser();
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - authentication required'
        });
      }

      const { slot_id } = req.query;

      if (!slot_id) {
        return res.status(400).json({
          success: false,
          error: 'slot_id is required'
        });
      }

      // Get slot and verify ownership
      const { data: slot, error: slotError } = await supabase
        .from('tour_availability_slots')
        .select('tour_id, tours!inner(guide_id)')
        .eq('id', slot_id)
        .single();

      if (slotError || !slot) {
        return res.status(404).json({
          success: false,
          error: 'Availability slot not found'
        });
      }

      if (slot.tours.guide_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete availability for your own tours'
        });
      }

      // Instead of deleting, mark as blocked
      const { error: updateError } = await supabase
        .from('tour_availability_slots')
        .update({ is_blocked: true, is_available: false })
        .eq('id', slot_id);

      if (updateError) {
        console.error('Error blocking availability slot:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to block availability slot'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Availability slot blocked'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Error in guide-availability API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

