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
      const profile = {
        avatar: guideProfile.avatar_url || '',
        bio: guideProfile.bio || '',
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
      // Try both id and user_id (depending on table structure)
      let existingGuide = null;
      let checkError = null;
      
      // First try with id
      const { data: guideById, error: errorById } = await supabase
        .from('guides')
        .select('id, user_id')
        .eq('id', userId)
        .maybeSingle();
      
      if (!errorById && guideById) {
        existingGuide = guideById;
      } else {
        // Try with user_id
        const { data: guideByUserId, error: errorByUserId } = await supabase
          .from('guides')
          .select('id, user_id')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (!errorByUserId && guideByUserId) {
          existingGuide = guideByUserId;
        } else {
          checkError = errorByUserId || errorById;
        }
      }
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Profile check error:', checkError);
        return res.status(500).json({
          success: false,
          message: 'Error checking profile',
          error: checkError.message
        });
      }

      let result;
      if (existingGuide) {
        // Update existing profile
        const updateData = { ...guideData };
        
        // Determine which field to use for WHERE clause
        const whereField = existingGuide.user_id ? 'user_id' : 'id';
        const whereValue = existingGuide.user_id || existingGuide.id || userId;
        
        // Note: Try both id and user_id depending on table structure
        const { data: updatedGuide, error: updateError } = await supabase
          .from('guides')
          .update(updateData)
          .eq(whereField, whereValue)
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

        result = updatedGuide;
      } else {
        // Create new profile
        // Try both id and user_id approaches
        guideData.created_at = new Date().toISOString();
        
        // First try with id
        let newGuide = null;
        let insertError = null;
        
        try {
          guideData.id = userId;
          const { data: guideWithId, error: errorWithId } = await supabase
            .from('guides')
            .insert(guideData)
            .select()
            .single();
          
          if (!errorWithId) {
            newGuide = guideWithId;
          } else {
            // If id fails, try with user_id
            delete guideData.id;
            guideData.user_id = userId;
            const { data: guideWithUserId, error: errorWithUserId } = await supabase
              .from('guides')
              .insert(guideData)
              .select()
              .single();
            
            if (!errorWithUserId) {
              newGuide = guideWithUserId;
            } else {
              insertError = errorWithUserId;
            }
          }
        } catch (err) {
          insertError = err;
        }

        if (insertError || !newGuide) {
          console.error('Profile creation error:', insertError);
          return res.status(500).json({
            success: false,
            message: 'Error creating profile',
            error: insertError?.message || 'Failed to create profile'
          });
        }

        result = newGuide;
      }

      // Format response
      // Note: schema uses instagram, facebook, twitter, linkedin (not _url suffix)
      const profile = {
        avatar: result.avatar_url || '',
        bio: result.bio || '',
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

