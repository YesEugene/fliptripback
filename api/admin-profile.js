/**
 * Admin Profile API Endpoint
 * Serverless function for managing admin profiles
 * Uses PostgreSQL/Supabase (not Redis)
 * Similar to guide-profile.js but for admins table
 */

import { supabase } from '../database/db.js';

// Extract user ID from token (same as auth-me.js)
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
  // CORS headers - ВСЕГДА устанавливаем первыми
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS запрос - обрабатываем СРАЗУ
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.end();
    return;
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Проверка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization required' 
      });
    }

    // Extract user ID from token (same as auth-me.js)
    const userId = getUserIdFromToken(authHeader);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    // Проверка роли (только админы могут управлять профилем)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Allow only 'admin' role
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can manage admin profiles' 
      });
    }

    // GET - получение профиля
    if (req.method === 'GET') {
      // Check if admin profile exists
      // Note: admins.id = users.id (not user_id)
      const { data: adminProfile, error: profileError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Profile lookup error:', profileError);
        return res.status(500).json({ 
          success: false, 
          message: 'Error fetching profile',
          error: profileError.message
        });
      }

      // If profile doesn't exist, return empty profile
      if (!adminProfile) {
        return res.status(200).json({
          success: true,
          profile: {
            avatar: '',
            bio: '',
            name: user.name || user.email?.split('@')[0] || 'Admin'
          }
        });
      }

      // Format profile data
      const profile = {
        avatar: adminProfile.avatar_url || '',
        bio: adminProfile.bio || '',
        name: adminProfile.name || user.name || user.email?.split('@')[0] || 'Admin'
      };
      
      return res.status(200).json({
        success: true,
        profile
      });
    }

    // PUT - обновление/создание профиля
    if (req.method === 'PUT') {
      const profileData = req.body;

      // Prepare admin data for insert/update
      // Note: admins.id = users.id (not user_id)
      const adminData = {
        id: userId, // id совпадает с users.id
        name: profileData.name || user.name || user.email?.split('@')[0] || 'Admin',
        bio: profileData.bio || null,
        avatar_url: profileData.avatar || null,
        updated_at: new Date().toISOString()
      };

      // Remove null values for optional fields to avoid constraint issues
      Object.keys(adminData).forEach(key => {
        if (adminData[key] === null && key !== 'id' && key !== 'name') {
          delete adminData[key];
        }
      });

      // Check if admin profile exists
      // Note: admins.id = users.id (not user_id)
      const { data: existingAdmin, error: checkError } = await supabase
        .from('admins')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Profile check error:', checkError);
        return res.status(500).json({
          success: false,
          message: 'Error checking profile',
          error: checkError.message
        });
      }

      let result;
      if (existingAdmin) {
        // Update existing profile
        // Don't update id on existing records
        const updateData = { ...adminData };
        delete updateData.id;
        
        // Note: admins.id = users.id (not user_id)
        const { data: updatedAdmin, error: updateError } = await supabase
          .from('admins')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Profile update error:', updateError);
          return res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: updateError.message
          });
        }

        result = updatedAdmin;
      } else {
        // Create new profile
        adminData.created_at = new Date().toISOString();
        const { data: newAdmin, error: insertError } = await supabase
          .from('admins')
          .insert(adminData)
          .select()
          .single();

        if (insertError) {
          console.error('Profile creation error:', insertError);
          return res.status(500).json({
            success: false,
            message: 'Error creating profile',
            error: insertError.message
          });
        }

        result = newAdmin;
      }

      // Format response
      const profile = {
        avatar: result.avatar_url || '',
        bio: result.bio || '',
        name: result.name || user.name || user.email?.split('@')[0] || 'Admin'
      };

      return res.status(200).json({
        success: true,
        profile
      });
    }

    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message 
    });
  }
}

