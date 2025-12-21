/**
 * Tour Bookings API - Manage tour bookings
 * Endpoints for creating and managing tour bookings with guides
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

    // Get user from token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // GET - Get bookings
    if (req.method === 'GET') {
      const { tour_id, guide_id, user_id, status } = req.query;

      let query = supabase
        .from('tour_bookings')
        .select(`
          *,
          tour:tours(id, title, city_id, cities(name)),
          customer:users!tour_bookings_user_id_fkey(id, name, email),
          guide:users!tour_bookings_guide_id_fkey(id, name, email)
        `)
        .order('created_at', { ascending: false });

      // Filter by tour_id (for guide or customer)
      if (tour_id) {
        query = query.eq('tour_id', tour_id);
      }

      // Filter by guide_id (guide sees their bookings)
      if (guide_id) {
        query = query.eq('guide_id', guide_id);
      }

      // Filter by user_id (customer sees their bookings)
      if (user_id) {
        query = query.eq('user_id', user_id);
      }

      // Filter by status
      if (status) {
        query = query.eq('status', status);
      }

      // Security: users can only see their own bookings or bookings for their tours
      // If no filters, show only user's bookings
      if (!tour_id && !guide_id && !user_id) {
        // Show bookings where user is either customer or guide
        query = query.or(`user_id.eq.${userId},guide_id.eq.${userId}`);
      } else {
        // If filters are set, verify access
        if (guide_id && guide_id !== userId) {
          return res.status(403).json({
            success: false,
            error: 'You can only view your own bookings as a guide'
          });
        }
        if (user_id && user_id !== userId) {
          return res.status(403).json({
            success: false,
            error: 'You can only view your own bookings as a customer'
          });
        }
      }

      const { data: bookings, error } = await query;

      if (error) {
        console.error('Error fetching bookings:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch bookings'
        });
      }

      // Format response
      const formattedBookings = (bookings || []).map(booking => ({
        id: booking.id,
        tour_id: booking.tour_id,
        tour_title: booking.tour?.title || 'Unknown Tour',
        tour_city: booking.tour?.cities?.name || null,
        user_id: booking.user_id,
        customer_name: booking.customer?.name || 'Unknown',
        customer_email: booking.customer?.email || null,
        guide_id: booking.guide_id,
        guide_name: booking.guide?.name || 'Unknown',
        tour_date: booking.tour_date,
        meeting_point: booking.meeting_point,
        meeting_time: booking.meeting_time,
        group_size: booking.group_size,
        participants: booking.participants,
        base_price: booking.base_price,
        additional_services_price: booking.additional_services_price,
        total_price: booking.total_price,
        currency: booking.currency,
        status: booking.status,
        payment_status: booking.payment_status,
        additional_services: booking.additional_services,
        customer_notes: booking.customer_notes,
        guide_notes: booking.guide_notes,
        created_at: booking.created_at,
        confirmed_at: booking.confirmed_at,
        cancelled_at: booking.cancelled_at
      }));

      return res.status(200).json({
        success: true,
        bookings: formattedBookings
      });
    }

    // POST - Create booking
    if (req.method === 'POST') {
      const {
        tour_id,
        tour_date,
        group_size = 1,
        participants,
        additional_services = {},
        customer_notes,
        meeting_point,
        meeting_time
      } = req.body;

      if (!tour_id || !tour_date) {
        return res.status(400).json({
          success: false,
          error: 'tour_id and tour_date are required'
        });
      }

      // Get tour details
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('id, guide_id, price_guided, currency, meta')
        .eq('id', tour_id)
        .single();

      if (tourError || !tour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      if (!tour.guide_id) {
        return res.status(400).json({
          success: false,
          error: 'This tour does not have a guide'
        });
      }

      // Check availability
      const { data: availability, error: availError } = await supabase
        .from('tour_availability_slots')
        .select('*')
        .eq('tour_id', tour_id)
        .eq('date', tour_date)
        .single();

      if (availError || !availability) {
        return res.status(400).json({
          success: false,
          error: 'Date is not available for booking'
        });
      }

      if (availability.is_blocked || !availability.is_available) {
        return res.status(400).json({
          success: false,
          error: 'This date is blocked or not available'
        });
      }

      // Check if there are enough spots
      const availableSpots = availability.max_group_size - (availability.booked_spots || 0);
      if (group_size > availableSpots) {
        return res.status(400).json({
          success: false,
          error: `Not enough spots available. Only ${availableSpots} spots left.`
        });
      }

      // Calculate price
      const basePrice = availability.custom_price || tour.price_guided || 0;
      let additionalServicesPrice = 0;

      // Calculate additional services price (if any)
      if (additional_services && typeof additional_services === 'object') {
        // This would need to be calculated based on tour's additional options
        // For now, we'll set it to 0
        additionalServicesPrice = 0;
      }

      const totalPrice = basePrice * group_size + additionalServicesPrice;

      // Get meeting point and time from tour meta or use provided
      const tourMeta = tour.meta || {};
      const finalMeetingPoint = meeting_point || tourMeta.meeting_point || null;
      const finalMeetingTime = meeting_time || tourMeta.meeting_time || null;

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .insert({
          tour_id: tour.id,
          user_id: userId,
          guide_id: tour.guide_id,
          tour_date: tour_date,
          meeting_point: finalMeetingPoint,
          meeting_time: finalMeetingTime,
          group_size: group_size,
          participants: participants || null,
          base_price: basePrice,
          additional_services_price: additionalServicesPrice,
          total_price: totalPrice,
          currency: tour.currency || 'USD',
          status: 'pending',
          payment_status: 'pending',
          additional_services: additional_services,
          customer_notes: customer_notes || null
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Error creating booking:', bookingError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create booking'
        });
      }

      // The trigger will automatically update booked_spots in tour_availability_slots

      return res.status(201).json({
        success: true,
        booking: {
          id: booking.id,
          tour_id: booking.tour_id,
          tour_date: booking.tour_date,
          group_size: booking.group_size,
          total_price: booking.total_price,
          status: booking.status,
          payment_status: booking.payment_status
        }
        // checkout_session_id would be added here if integrating with Stripe
      });
    }

    // PUT - Update booking
    if (req.method === 'PUT') {
      const { booking_id } = req.query;
      const { status, guide_notes, customer_notes } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          error: 'booking_id is required'
        });
      }

      // Get booking
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .select('*')
        .eq('id', booking_id)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      // Verify access: user must be either the guide or the customer
      if (booking.guide_id !== userId && booking.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own bookings'
        });
      }

      const updateData = {};
      
      // Only guide can change status and guide_notes
      if (booking.guide_id === userId) {
        if (status) {
          updateData.status = status;
          if (status === 'confirmed') {
            updateData.confirmed_at = new Date().toISOString();
          }
          if (status === 'cancelled') {
            updateData.cancelled_at = new Date().toISOString();
          }
        }
        if (guide_notes !== undefined) {
          updateData.guide_notes = guide_notes;
        }
      }

      // Customer can update customer_notes
      if (booking.user_id === userId && customer_notes !== undefined) {
        updateData.customer_notes = customer_notes;
      }

      const { data: updated, error: updateError } = await supabase
        .from('tour_bookings')
        .update(updateData)
        .eq('id', booking_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating booking:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update booking'
        });
      }

      return res.status(200).json({
        success: true,
        booking: updated
      });
    }

    // DELETE - Cancel booking
    if (req.method === 'DELETE') {
      const { booking_id } = req.query;
      const { cancellation_reason } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          error: 'booking_id is required'
        });
      }

      // Get booking
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .select('*')
        .eq('id', booking_id)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      // Verify access: user must be either the guide or the customer
      if (booking.guide_id !== userId && booking.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only cancel your own bookings'
        });
      }

      // Update status to cancelled
      const { data: updated, error: updateError } = await supabase
        .from('tour_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          guide_notes: cancellation_reason ? 
            (booking.guide_notes ? `${booking.guide_notes}\nCancellation: ${cancellation_reason}` : `Cancellation: ${cancellation_reason}`) :
            booking.guide_notes
        })
        .eq('id', booking_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error cancelling booking:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to cancel booking'
        });
      }

      // The trigger will automatically update booked_spots in tour_availability_slots

      return res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        booking: updated
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Error in tour-bookings API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

