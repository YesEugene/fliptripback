/**
 * Tour Content Blocks API - CRUD operations for tour content blocks
 * Handles creation, reading, updating, and deletion of content blocks for tours
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
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Helper function to get user ID and role from token
  const getUserFromToken = async (authHeader) => {
    if (!authHeader) {
      console.warn('⚠️ No auth header provided');
      return { userId: null, isAdmin: false };
    }
    
    let userId = null;
    try {
      const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      try {
        const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
        userId = payload.userId || payload.id || payload.sub;
        console.log('🔑 Extracted userId from JWT payload:', userId);
      } catch (e) {
        console.log('🔑 Trying Supabase auth.getUser...');
        const { data: { user }, error: authError } = await supabase.auth.getUser(cleanToken);
        if (!authError && user) {
          userId = user.id;
          console.log('🔑 Extracted userId from Supabase auth:', userId);
        } else {
          console.error('❌ Supabase auth error:', authError);
        }
      }
    } catch (error) {
      console.error('❌ Token decode error:', error);
    }
    
    if (!userId) {
      console.warn('⚠️ Could not extract userId from token');
      return { userId: null, isAdmin: false };
    }
    
    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
    }
    
    const isAdmin = userData?.role === 'admin';
    console.log(`👤 User ${userId} - role: ${userData?.role}, isAdmin: ${isAdmin}`);
    return { userId, isAdmin, userData };
  };
  
  // Helper function to check if user can edit tour
  const canEditTour = async (tourId, userId, isAdmin) => {
    if (isAdmin) {
      console.log(`✅ Admin access granted for tour ${tourId}`);
      return true; // Admin can edit any tour
    }
    
    if (!userId) {
      console.warn(`⚠️ No userId provided for tour ${tourId}`);
      return false;
    }
    
    // Get tour owner - use select('*') to get all columns, then check which ones exist
    // This avoids errors if some columns don't exist in the schema
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single();
    
    if (tourError) {
      console.error(`❌ Error fetching tour ${tourId}:`, tourError);
      return false;
    }
    
    if (!tour) {
      console.warn(`⚠️ Tour ${tourId} not found`);
      return false;
    }
    
    // Check ownership - handle null values properly
    // Try different column names in order of preference
    // The schema uses guide_id, but we check other possible names for compatibility
    let ownerId = null;
    if (tour.guide_id !== null && tour.guide_id !== undefined) {
      ownerId = tour.guide_id;
    } else if (tour.creator_id !== null && tour.creator_id !== undefined) {
      ownerId = tour.creator_id;
    } else if (tour.user_id !== null && tour.user_id !== undefined) {
      ownerId = tour.user_id;
    } else if (tour.created_by !== null && tour.created_by !== undefined) {
      ownerId = tour.created_by;
    }
    
    console.log(`🔐 Permission check for tour ${tourId}:`, {
      userId,
      ownerId,
      guide_id: tour.guide_id,
      has_creator_id: 'creator_id' in tour,
      has_user_id: 'user_id' in tour,
      has_created_by: 'created_by' in tour,
      match: ownerId === userId,
      ownerIdType: typeof ownerId,
      userIdType: typeof userId
    });
    
    if (!ownerId) {
      console.warn(`⚠️ No owner ID found for tour ${tourId}`);
      return false;
    }
    
    // Compare as strings to handle UUID comparison issues
    const isOwner = String(ownerId) === String(userId);
    
    if (!isOwner) {
      console.warn(`⚠️ Permission denied: userId ${userId} !== ownerId ${ownerId}`);
    } else {
      console.log(`✅ Permission granted: userId ${userId} matches ownerId ${ownerId}`);
    }
    
    return isOwner;
  };

  const isValidUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

  const extractLocationCandidates = (content) => {
    if (!content || typeof content !== 'object') return [];
    const list = [];
    const pushIfValid = (loc) => {
      if (!loc || typeof loc !== 'object') return;
      const name = (loc.title || loc.name || '').toString().trim();
      if (!name) return;
      list.push(loc);
    };
    pushIfValid(content.mainLocation || content);
    if (Array.isArray(content.alternativeLocations)) {
      content.alternativeLocations.forEach(pushIfValid);
    }
    return list;
  };

  const extractInterestIds = (location) => {
    const interests = Array.isArray(location?.interests) ? location.interests : [];
    return interests
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return item;
        if (item && (item.id !== undefined && item.id !== null)) return item.id;
        if (item && (item.interest_id !== undefined && item.interest_id !== null)) return item.interest_id;
        return null;
      })
      .filter((id) => id !== null && id !== undefined && id !== '');
  };

  const syncLocationsFromLocationBlock = async ({ tourId, blockContent, userId }) => {
    try {
      const candidates = extractLocationCandidates(blockContent);
      if (candidates.length === 0) return;

      const { data: tourData } = await supabase
        .from('tours')
        .select('city_id, source')
        .eq('id', tourId)
        .maybeSingle();

      const fallbackCityId = tourData?.city_id || null;
      const locationSource = String(tourData?.source || '').toLowerCase() === 'user_generated'
        ? 'ai'
        : 'guide';

      for (const loc of candidates) {
        const name = (loc.title || loc.name || '').toString().trim();
        const address = (loc.address || '').toString().trim() || null;
        const cityId = loc.city_id || fallbackCityId || null;
        const googlePlaceId = (loc.place_id || loc.google_place_id || '').toString().trim() || null;
        const description = (loc.description || '').toString().trim() || null;
        const recommendations = (loc.recommendations || '').toString().trim() || null;
        const rawPriceLevel = loc.price_level ?? loc.priceLevel ?? null;
        const parsedPriceLevel = rawPriceLevel !== null && rawPriceLevel !== undefined && rawPriceLevel !== ''
          ? parseInt(rawPriceLevel, 10)
          : 2;
        const priceLevel = Number.isNaN(parsedPriceLevel) ? 2 : parsedPriceLevel;

        if (!name) {
          continue;
        }

        let existingLocation = null;

        if (googlePlaceId) {
          const { data } = await supabase
            .from('locations')
            .select('id')
            .eq('google_place_id', googlePlaceId)
            .maybeSingle();
          existingLocation = data || null;
        }

        if (!existingLocation) {
          let query = supabase
            .from('locations')
            .select('id')
            .eq('name', name);

          if (cityId) {
            query = query.eq('city_id', cityId);
          } else {
            query = query.is('city_id', null);
          }

          if (address) query = query.eq('address', address);
          const { data } = await query.maybeSingle();
          existingLocation = data || null;
        }

        const baseData = {
          name,
          city_id: cityId,
          address,
          description,
          recommendations,
          source: locationSource,
          google_place_id: googlePlaceId,
          price_level: priceLevel
        };

        if (existingLocation?.id) {
          const updateData = { ...baseData };
          if (isValidUuid(userId)) updateData.updated_by = userId;
          await supabase
            .from('locations')
            .update(updateData)
            .eq('id', existingLocation.id);

          const interestIds = extractInterestIds(loc);
          if (interestIds.length > 0) {
            await supabase.from('location_interests').delete().eq('location_id', existingLocation.id);
            await supabase.from('location_interests').insert(
              interestIds.map((interestId) => ({
                location_id: existingLocation.id,
                interest_id: interestId
              }))
            );
          }
        } else {
          const insertData = { ...baseData };
          if (isValidUuid(userId)) {
            insertData.created_by = userId;
            insertData.updated_by = userId;
          }

          const { data: createdLocation } = await supabase
            .from('locations')
            .insert(insertData)
            .select('id')
            .single();

          if (createdLocation?.id) {
            const interestIds = extractInterestIds(loc);
            if (interestIds.length > 0) {
              await supabase.from('location_interests').insert(
                interestIds.map((interestId) => ({
                  location_id: createdLocation.id,
                  interest_id: interestId
                }))
              );
            }
          }
        }
      }
    } catch (syncError) {
      console.warn('⚠️ Failed to sync locations from location block:', syncError?.message || syncError);
    }
  };

  try {
    // GET - Get all blocks for a tour
    if (req.method === 'GET') {
      const { tourId } = req.query;

      if (!tourId) {
        return res.status(400).json({ error: 'tourId is required' });
      }

      const { data: blocks, error } = await supabase
        .from('tour_content_blocks')
        .select('*')
        .eq('tour_id', tourId)
        .order('order_index', { ascending: true });

      if (error) {
        // If table doesn't exist, return empty array instead of error
        if (error.message && error.message.includes('does not exist')) {
          console.log('⚠️ tour_content_blocks table does not exist yet. Returning empty array.');
          return res.status(200).json({ success: true, blocks: [] });
        }
        console.error('❌ Error fetching content blocks:', error);
        return res.status(500).json({ error: 'Failed to fetch content blocks' });
      }

      return res.status(200).json({ success: true, blocks: blocks || [] });
    }

    // POST - Create a new content block
    if (req.method === 'POST') {
      const { tourId, blockType, content, orderIndex } = req.body;

      if (!tourId || !blockType) {
        return res.status(400).json({ error: 'tourId and blockType are required' });
      }

      // Check authorization and permissions
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId, isAdmin } = await getUserFromToken(authHeader);
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check if user can edit this tour
      const canEdit = await canEditTour(tourId, userId, isAdmin);
      if (!canEdit) {
        return res.status(403).json({ 
          error: 'You can only edit your own tours',
          isAdmin 
        });
      }

      // Determine insertion index.
      let newOrderIndex = orderIndex;
      if (newOrderIndex === undefined || newOrderIndex === null) {
        const { data: existingBlocks } = await supabase
          .from('tour_content_blocks')
          .select('order_index')
          .eq('tour_id', tourId)
          .order('order_index', { ascending: false })
          .limit(1);

        newOrderIndex = existingBlocks && existingBlocks.length > 0
          ? existingBlocks[0].order_index + 1
          : 0;
      }

      // CRITICAL: When inserting at a specific position, shift all existing blocks
      // at/after that index to keep a stable, collision-free order.
      if (newOrderIndex !== undefined && newOrderIndex !== null) {
        const { data: blocksToShift, error: shiftSelectError } = await supabase
          .from('tour_content_blocks')
          .select('id, order_index')
          .eq('tour_id', tourId)
          .gte('order_index', newOrderIndex)
          .order('order_index', { ascending: false });

        if (shiftSelectError) {
          console.warn('⚠️ Failed to fetch blocks for order shift:', shiftSelectError?.message || shiftSelectError);
        } else if (Array.isArray(blocksToShift) && blocksToShift.length > 0) {
          for (const existing of blocksToShift) {
            await supabase
              .from('tour_content_blocks')
              .update({ order_index: (existing.order_index || 0) + 1 })
              .eq('id', existing.id);
          }
        }
      }

      // Create default content based on block type
      const defaultContent = getDefaultContent(blockType);

      const { data: block, error } = await supabase
        .from('tour_content_blocks')
        .insert({
          tour_id: tourId,
          block_type: blockType,
          content: content || defaultContent,
          order_index: newOrderIndex
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating content block:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        console.error('❌ Request body:', JSON.stringify({ tourId, blockType, content, orderIndex: newOrderIndex }, null, 2));
        
        // If table doesn't exist, return helpful error message
        if (error.message && (error.message.includes('does not exist') || error.code === 'PGRST205')) {
          return res.status(500).json({ 
            error: 'Failed to create content block',
            details: error.message,
            code: error.code,
            hint: 'Please run the migration: add-tour-content-blocks.sql in Supabase SQL Editor'
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to create content block',
          details: error.message,
          code: error.code
        });
      }

      if (blockType === 'location' && block?.content) {
        await syncLocationsFromLocationBlock({
          tourId,
          blockContent: block.content,
          userId
        });
      }

      return res.status(201).json({ success: true, block });
    }

    // PUT - Update a content block
    if (req.method === 'PUT') {
      const { blockId, content, orderIndex } = req.body;

      console.log(`📝 PUT request to update block ${blockId}`);

      if (!blockId) {
        return res.status(400).json({ error: 'blockId is required' });
      }

      // Check authorization and permissions
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.warn('⚠️ No authorization header in PUT request');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId, isAdmin, userData } = await getUserFromToken(authHeader);
      console.log(`🔐 PUT request - userId: ${userId}, isAdmin: ${isAdmin}`);
      
      if (!userId) {
        console.warn('⚠️ Could not extract userId from token');
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get tour_id from block to check permissions
      const { data: existingBlock, error: blockError } = await supabase
        .from('tour_content_blocks')
        .select('tour_id, block_type')
        .eq('id', blockId)
        .single();

      if (blockError) {
        console.error('❌ Error fetching block:', blockError);
        return res.status(404).json({ error: 'Block not found', details: blockError.message });
      }

      if (!existingBlock) {
        console.warn(`⚠️ Block ${blockId} not found`);
        return res.status(404).json({ error: 'Block not found' });
      }

      console.log(`🔍 Block ${blockId} belongs to tour ${existingBlock.tour_id}`);

      // Check if user can edit this tour
      const canEdit = await canEditTour(existingBlock.tour_id, userId, isAdmin);
      if (!canEdit) {
        console.error(`❌ Permission denied: User ${userId} cannot edit tour ${existingBlock.tour_id}`);
        return res.status(403).json({ 
          error: 'You can only edit your own tours',
          isAdmin,
          userId,
          tourId: existingBlock.tour_id
        });
      }

      console.log(`✅ Permission granted: User ${userId} can edit tour ${existingBlock.tour_id}`);

      const updateData = {};
      if (content !== undefined) updateData.content = content;
      if (orderIndex !== undefined) updateData.order_index = orderIndex;

      const { data: block, error } = await supabase
        .from('tour_content_blocks')
        .update(updateData)
        .eq('id', blockId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating content block:', error);
        // If table doesn't exist, return helpful error message
        if (error.message && error.message.includes('does not exist')) {
          return res.status(500).json({ 
            error: 'Failed to update content block',
            details: error.message,
            hint: 'Please run the migration: add-tour-content-blocks.sql in Supabase SQL Editor'
          });
        }
        return res.status(500).json({ 
          error: 'Failed to update content block',
          details: error.message
        });
      }

      if (content !== undefined && existingBlock?.block_type === 'location') {
        await syncLocationsFromLocationBlock({
          tourId: existingBlock.tour_id,
          blockContent: content,
          userId
        });
      }

      return res.status(200).json({ success: true, block });
    }

    // DELETE - Delete a content block
    if (req.method === 'DELETE') {
      const { blockId } = req.query;

      console.log(`🗑️ DELETE request to delete block ${blockId}`);

      if (!blockId) {
        return res.status(400).json({ error: 'blockId is required' });
      }

      // Check authorization and permissions
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.warn('⚠️ No authorization header in DELETE request');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId, isAdmin } = await getUserFromToken(authHeader);
      console.log(`🔐 DELETE request - userId: ${userId}, isAdmin: ${isAdmin}`);
      
      if (!userId) {
        console.warn('⚠️ Could not extract userId from token');
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get tour_id from block to check permissions
      const { data: existingBlock, error: blockError } = await supabase
        .from('tour_content_blocks')
        .select('tour_id')
        .eq('id', blockId)
        .single();

      if (blockError) {
        console.error('❌ Error fetching block:', blockError);
        return res.status(404).json({ error: 'Block not found', details: blockError.message });
      }

      if (!existingBlock) {
        console.warn(`⚠️ Block ${blockId} not found`);
        return res.status(404).json({ error: 'Block not found' });
      }

      console.log(`🔍 Block ${blockId} belongs to tour ${existingBlock.tour_id}`);

      // Check if user can edit this tour
      const canEdit = await canEditTour(existingBlock.tour_id, userId, isAdmin);
      if (!canEdit) {
        console.error(`❌ Permission denied: User ${userId} cannot delete block from tour ${existingBlock.tour_id}`);
        return res.status(403).json({ 
          error: 'You can only edit your own tours',
          isAdmin,
          userId,
          tourId: existingBlock.tour_id
        });
      }

      console.log(`✅ Permission granted: User ${userId} can delete block from tour ${existingBlock.tour_id}`);

      const { error } = await supabase
        .from('tour_content_blocks')
        .delete()
        .eq('id', blockId);

      if (error) {
        console.error('❌ Error deleting content block:', error);
        // If table doesn't exist, return helpful error message
        if (error.message && error.message.includes('does not exist')) {
          return res.status(500).json({ 
            error: 'Failed to delete content block',
            details: error.message,
            hint: 'Please run the migration: add-tour-content-blocks.sql in Supabase SQL Editor'
          });
        }
        return res.status(500).json({ 
          error: 'Failed to delete content block',
          details: error.message
        });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ Unexpected error in tour-content-blocks API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get default content structure for a block type
 */
function getDefaultContent(blockType) {
  switch (blockType) {
    case 'location':
      return {
        tour_block_id: null, // Reference to tour_blocks.id
        tour_item_ids: [] // Array of tour_items.id
      };
    
    case 'title':
      return {
        text: 'Lorem ipsum dolor conta me more upsi colora',
        size: 'large' // 'small', 'medium', 'large'
      };
    
    case 'photo_text':
      return {
        photo: null, // URL or base64
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        alignment: 'left' // 'left', 'right'
      };
    
    case 'text':
      return {
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        formatted: false // Whether text contains HTML formatting
      };
    
    case 'slide':
      return {
        title: 'Slide Title',
        photo: null,
        text: 'Slide description text'
      };
    
    case '3columns':
      return {
        columns: [
          { photo: null, text: 'Column 1 text' },
          { photo: null, text: 'Column 2 text' },
          { photo: null, text: 'Column 3 text' }
        ]
      };
    
    case 'photo':
      return {
        photo: null,
        caption: ''
      };
    
    case 'divider':
      return {
        style: 'solid' // 'solid', 'dashed', 'dotted'
      };
    
    default:
      return {};
  }
}

