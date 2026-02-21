/**
 * Guide Profile API Endpoint
 * Serverless function for managing guide profiles
 * Uses PostgreSQL/Supabase (not Redis)
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

    // Проверка роли (только гиды/creators могут управлять профилем)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Allow both 'guide' and 'creator' roles (they are the same)
    if (user.role !== 'guide' && user.role !== 'creator') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only guides/creators can manage profiles' 
      });
    }

    // GET - получение профиля
    if (req.method === 'GET') {
      // Check if guide profile exists
      // Note: guides.id = users.id (not user_id)
      const { data: guideProfile, error: profileError } = await supabase
        .from('guides')
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
      if (!guideProfile) {
        return res.status(200).json({
          success: true,
          profile: {
            avatar: '',
            bio: '',
            socialLinks: {
              instagram: '',
              facebook: '',
              twitter: '',
              linkedin: '',
              website: ''
            }
          }
        });
      }

      // Format profile data
      // Note: schema uses instagram, facebook, twitter, linkedin (not _url suffix)
      // Note: table has both 'avatar' and 'avatar_url' - prefer avatar_url, fallback to avatar
      const profile = {
        name: guideProfile.name || user.name || user.email?.split('@')[0] || '',
        avatar: guideProfile.avatar_url || guideProfile.avatar || '',
        bio: guideProfile.bio || '',
        city: guideProfile.city || '',
        interests: guideProfile.interests || '',
        socialLinks: {
          instagram: guideProfile.instagram || '',
          facebook: guideProfile.facebook || '',
          twitter: guideProfile.twitter || '',
          linkedin: guideProfile.linkedin || '',
          website: guideProfile.website || ''
        }
      };
      
      return res.status(200).json({
        success: true,
        profile
      });
    }

    // PUT - обновление/создание профиля
    if (req.method === 'PUT') {
      const profileData = req.body;

      // Prepare guide data for insert/update
      // Note: schema uses instagram, facebook, twitter, linkedin (not _url suffix)
      // Note: guides table might use user_id or id - we'll try both approaches
      const guideData = {
        name: profileData.name || user.email?.split('@')[0] || 'Guide',
        bio: profileData.bio || null,
        city: profileData.city || null,
        interests: profileData.interests || null,
        instagram: profileData.socialLinks?.instagram || null,
        facebook: profileData.socialLinks?.facebook || null,
        twitter: profileData.socialLinks?.twitter || null,
        linkedin: profileData.socialLinks?.linkedin || null,
        website: profileData.socialLinks?.website || null,
        updated_at: new Date().toISOString()
      };

      // Add avatar_url only if profileData.avatar is provided (to avoid column errors)
      if (profileData.avatar !== null && profileData.avatar !== undefined && profileData.avatar !== '') {
        guideData.avatar_url = profileData.avatar;
      }

      // Remove null values for optional fields to avoid constraint issues
      Object.keys(guideData).forEach(key => {
        if (guideData[key] === null && key !== 'name') {
          delete guideData[key];
        }
      });

      // Check if guide profile exists
      // Table uses 'id' (not 'user_id') - id matches users.id
      const { data: existingGuide, error: checkError } = await supabase
        .from('guides')
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

      // Helper: attempt upsert, retry without new columns if they don't exist yet
      const attemptSave = async (data, isInsert) => {
        if (isInsert) {
          data.id = userId;
          data.created_at = new Date().toISOString();
          const { data: row, error } = await supabase
            .from('guides')
            .insert(data)
            .select()
            .single();
          return { row, error };
        } else {
          const { data: row, error } = await supabase
            .from('guides')
            .update(data)
            .eq('id', userId)
            .select()
            .single();
          return { row, error };
        }
      };

      const isInsert = !existingGuide;
      let result;

      // First attempt — with all fields including city & interests
      let { row, error: saveError } = await attemptSave({ ...guideData }, isInsert);

      if (saveError) {
        // If error is "column does not exist" (42703), retry without new columns
        if (saveError.code === '42703' && (saveError.message?.includes('city') || saveError.message?.includes('interests'))) {
          console.warn('⚠️ Columns city/interests do not exist in guides table, retrying without them');
          const fallbackData = { ...guideData };
          delete fallbackData.city;
          delete fallbackData.interests;
          const fallbackResult = await attemptSave(fallbackData, isInsert);
          if (fallbackResult.error) {
            console.error('Profile save error (fallback):', fallbackResult.error);
            return res.status(500).json({
              success: false,
              message: 'Error saving profile',
              error: fallbackResult.error.message
            });
          }
          row = fallbackResult.row;
        } else {
          console.error('Profile save error:', saveError);
          return res.status(500).json({
            success: false,
            message: isInsert ? 'Error creating profile' : 'Error updating profile',
            error: saveError.message
          });
        }
      }

      result = row;

      // Format response
      // Note: schema uses instagram, facebook, twitter, linkedin (not _url suffix)
      // Note: table has both 'avatar' and 'avatar_url' - prefer avatar_url, fallback to avatar
      const profile = {
        name: result.name || user.name || user.email?.split('@')[0] || '',
        avatar: result.avatar_url || result.avatar || '',
        bio: result.bio || '',
        city: result.city || '',
        interests: result.interests || '',
        socialLinks: {
          instagram: result.instagram || '',
          facebook: result.facebook || '',
          twitter: result.twitter || '',
          linkedin: result.linkedin || '',
          website: result.website || ''
        }
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
    console.error('Guide profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message 
    });
  }
}

