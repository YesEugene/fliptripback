/**
 * Interests API Endpoint
 * GET /api/interests - Get interests structure
 * Supports filtering by category_id, subcategory_id
 */

import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { category_id, subcategory_id, full_structure } = req.query;

    // If full_structure is requested, return complete hierarchy
    if (full_structure === 'true') {
      const { data: categories, error: categoriesError } = await supabase
        .from('interest_categories')
        .select(`
          *,
          subcategories:interest_subcategories(
            *,
            interests:interests(*)
          )
        `)
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Also get direct interests (without subcategory)
      const { data: directInterests, error: directError } = await supabase
        .from('interests')
        .select('*')
        .is('subcategory_id', null)
        .order('display_order', { ascending: true });

      if (directError) throw directError;

      // Group direct interests by category
      const categoriesWithDirect = categories.map(category => ({
        ...category,
        subcategories: category.subcategories || [],
        direct_interests: directInterests.filter(interest => interest.category_id === category.id)
      }));

      return res.status(200).json({
        success: true,
        categories: categoriesWithDirect
      });
    }

    // If category_id is provided, get interests for that category
    if (category_id) {
      if (subcategory_id) {
        // Get interests for specific subcategory
        const { data: interests, error } = await supabase
          .from('interests')
          .select('*')
          .eq('subcategory_id', subcategory_id)
          .order('display_order', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, interests: interests || [] });
      } else {
        // Get all interests for category (both direct and via subcategories)
        const { data: interests, error } = await supabase
          .from('interests')
          .select('*')
          .eq('category_id', category_id)
          .order('display_order', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, interests: interests || [] });
      }
    }

    // If subcategory_id is provided, get interests for that subcategory
    if (subcategory_id) {
      const { data: interests, error } = await supabase
        .from('interests')
        .select('*')
        .eq('subcategory_id', subcategory_id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, interests: interests || [] });
    }

    // Default: return all categories with subcategories
    const { data: categories, error } = await supabase
      .from('interest_categories')
      .select(`
        *,
        subcategories:interest_subcategories(
          *,
          interests:interests(*)
        )
      `)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Get direct interests (without subcategory)
    const { data: directInterests, error: directError } = await supabase
      .from('interests')
      .select('*')
      .is('subcategory_id', null)
      .order('display_order', { ascending: true });

    if (directError) throw directError;

    // Group direct interests by category
    const categoriesWithDirect = categories.map(category => ({
      ...category,
      subcategories: category.subcategories || [],
      direct_interests: directInterests.filter(interest => interest.category_id === category.id)
    }));

    return res.status(200).json({
      success: true,
      categories: categoriesWithDirect
    });
  } catch (error) {
    console.error('Interests API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching interests',
      error: error.message
    });
  }
}

