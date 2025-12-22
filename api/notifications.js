/**
 * Notifications API
 * Endpoints for managing in-app notifications
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

    // GET - Get notifications for current user
    if (req.method === 'GET') {
      const { unread_only } = req.query;

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (unread_only === 'true') {
        query = query.eq('is_read', false);
      }

      const { data: notifications, error: notificationsError } = await query;

      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notifications'
        });
      }

      // Count unread
      const { count: unreadCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      return res.status(200).json({
        success: true,
        notifications: notifications || [],
        unreadCount: unreadCount || 0
      });
    }

    // PUT - Mark notification as read
    if (req.method === 'PUT') {
      const { notification_id, mark_all_read } = req.body;

      if (mark_all_read) {
        // Mark all notifications as read
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('is_read', false);

        if (updateError) {
          console.error('Error updating notifications:', updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to update notifications'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'All notifications marked as read'
        });
      }

      if (!notification_id) {
        return res.status(400).json({
          success: false,
          error: 'notification_id is required'
        });
      }

      // Verify user owns this notification
      const { data: notification, error: checkError } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('id', notification_id)
        .single();

      if (checkError || !notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Mark as read
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notification_id);

      if (updateError) {
        console.error('Error updating notification:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update notification'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    }

    // DELETE - Delete notification
    if (req.method === 'DELETE') {
      const { notification_id } = req.query;

      if (!notification_id) {
        return res.status(400).json({
          success: false,
          error: 'notification_id is required'
        });
      }

      // Verify user owns this notification
      const { data: notification, error: checkError } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('id', notification_id)
        .single();

      if (checkError || !notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Delete notification
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notification_id);

      if (deleteError) {
        console.error('Error deleting notification:', deleteError);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete notification'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification deleted'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Error in notifications API:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

