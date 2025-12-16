/**
 * Auth Module - Get Current User Endpoint
 * Serverless function to get current authenticated user (using PostgreSQL/Supabase)
 */

import { supabase } from '../database/db.js';

// Extract user ID from token
function getUserIdFromToken(token) {
  if (!token) return null;
  
  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Decode token (simple base64 for now)
    const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
    return payload.userId || payload.id || null;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers - устанавливаем в самом начале, ДО любых других операций
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Обработка preflight запроса - возвращаем сразу
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token not provided' 
      });
    }

    // Extract user ID from token
    const userId = getUserIdFromToken(authHeader);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    // Get user data from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, is_active')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Return user data (without password)
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      success: false, 
      message: 'Error getting user data',
      error: error.message 
    });
  }
}
