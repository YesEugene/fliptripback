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

      // Get current max order_index for this tour
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
        return res.status(500).json({ 
          error: 'Failed to create content block',
          details: error.message,
          code: error.code
        });
      }

      return res.status(201).json({ success: true, block });
    }

    // PUT - Update a content block
    if (req.method === 'PUT') {
      const { blockId, content, orderIndex } = req.body;

      if (!blockId) {
        return res.status(400).json({ error: 'blockId is required' });
      }

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

      return res.status(200).json({ success: true, block });
    }

    // DELETE - Delete a content block
    if (req.method === 'DELETE') {
      const { blockId } = req.query;

      if (!blockId) {
        return res.status(400).json({ error: 'blockId is required' });
      }

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

