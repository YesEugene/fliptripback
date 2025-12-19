/**
 * Check Guides Schema Endpoint
 * GET /api/check-guides-schema - Check the actual structure of guides table
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Try to get one record to see the structure
    const { data: sampleGuide, error: sampleError } = await supabase
      .from('guides')
      .select('*')
      .limit(1)
      .maybeSingle();

    // Try to get all columns by selecting specific ones
    const { data: allGuides, error: allError } = await supabase
      .from('guides')
      .select('id, name, bio, avatar_url, avatar, instagram, facebook, twitter, linkedin, website, created_at, updated_at')
      .limit(1);

    // Try to insert a test record (will fail but show column names)
    const testData = {
      id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      name: 'Test'
    };

    return res.status(200).json({
      success: true,
      sampleGuide: sampleGuide || null,
      sampleError: sampleError ? {
        code: sampleError.code,
        message: sampleError.message,
        details: sampleError.details,
        hint: sampleError.hint
      } : null,
      allGuides: allGuides || [],
      allError: allError ? {
        code: allError.code,
        message: allError.message,
        details: allError.details,
        hint: allError.hint
      } : null,
      note: 'Check the errors to see which columns exist. If avatar_url column is missing, the error will show it.'
    });
  } catch (error) {
    console.error('Check guides schema error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking guides schema',
      error: error.message
    });
  }
}

