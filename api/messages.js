/**
 * Messages API - Chat between guide and client
 * Endpoints for managing messages within a booking
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

    // GET - Get messages for a booking
    if (req.method === 'GET') {
      const { booking_id } = req.query;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          error: 'booking_id is required'
        });
      }

      // Verify user has access to this booking (either guide or client)
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .select('guide_id, user_id')
        .eq('id', booking_id)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      if (booking.guide_id !== userId && booking.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', booking_id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch messages'
        });
      }

      // Mark messages as read for current user
      if (messages && messages.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('booking_id', booking_id)
          .eq('receiver_id', userId)
          .eq('is_read', false);
      }

      return res.status(200).json({
        success: true,
        messages: messages || []
      });
    }

    // POST - Send a new message
    if (req.method === 'POST') {
      const { booking_id, message } = req.body;

      if (!booking_id || !message) {
        return res.status(400).json({
          success: false,
          error: 'booking_id and message are required'
        });
      }

      // Verify user has access to this booking
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .select('guide_id, user_id')
        .eq('id', booking_id)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      if (booking.guide_id !== userId && booking.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Determine receiver (opposite of sender)
      const receiverId = booking.guide_id === userId ? booking.user_id : booking.guide_id;

      // Create message
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          booking_id: booking_id,
          sender_id: userId,
          receiver_id: receiverId,
          message: message,
          is_read: false
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error creating message:', messageError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create message'
        });
      }

      return res.status(200).json({
        success: true,
        message: newMessage
      });
    }

    // PUT - Mark messages as read
    if (req.method === 'PUT') {
      const { booking_id } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          error: 'booking_id is required'
        });
      }

      // Verify user has access
      const { data: booking, error: bookingError } = await supabase
        .from('tour_bookings')
        .select('guide_id, user_id')
        .eq('id', booking_id)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      if (booking.guide_id !== userId && booking.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Mark all unread messages as read
      const { error: updateError } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('booking_id', booking_id)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (updateError) {
        console.error('Error updating messages:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update messages'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Messages marked as read'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Error in messages API:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

