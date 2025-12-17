/**
 * Diagnostic endpoint to check all tours in database
 * Helps identify why tours are not showing on homepage
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    console.log('🔍 Checking all tours in database...');

    // 1. Get ALL tours (no filters)
    const { data: allTours, error: allError } = await supabase
      .from('tours')
      .select('id, title, is_published, city_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('📊 All tours:', {
      count: allTours?.length || 0,
      error: allError?.message || null
    });

    // 2. Get published tours
    const { data: publishedTours, error: publishedError } = await supabase
      .from('tours')
      .select('id, title, is_published, city_id, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('📊 Published tours:', {
      count: publishedTours?.length || 0,
      error: publishedError?.message || null
    });

    // 3. Get unpublished tours
    const { data: unpublishedTours, error: unpublishedError } = await supabase
      .from('tours')
      .select('id, title, is_published, city_id, created_at')
      .eq('is_published', false)
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('📊 Unpublished tours:', {
      count: unpublishedTours?.length || 0,
      error: unpublishedError?.message || null
    });

    // 4. Check tours with null is_published
    const nullPublished = allTours?.filter(t => t.is_published === null || t.is_published === undefined) || [];

    // 5. Try the same query as in tours.js
    const { data: queryTours, error: queryError } = await supabase
      .from('tours')
      .select(`
        *,
        city:cities(name),
        tour_tags(
          tag:tags(id, name)
        )
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('📊 Query with joins:', {
      count: queryTours?.length || 0,
      error: queryError?.message || null,
      errorCode: queryError?.code || null
    });

    return res.status(200).json({
      success: true,
      summary: {
        total_tours: allTours?.length || 0,
        published_tours: publishedTours?.length || 0,
        unpublished_tours: unpublishedTours?.length || 0,
        null_published: nullPublished.length,
        query_with_joins: queryTours?.length || 0
      },
      all_tours: allTours || [],
      published_tours: publishedTours || [],
      unpublished_tours: unpublishedTours || [],
      null_published_tours: nullPublished,
      query_result: queryTours || [],
      errors: {
        all: allError?.message || null,
        published: publishedError?.message || null,
        unpublished: unpublishedError?.message || null,
        query: queryError?.message || null,
        queryCode: queryError?.code || null
      }
    });
  } catch (error) {
    console.error('❌ Check tours error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking tours',
      error: error.message 
    });
  }
}

