// Interests API - Returns full structure of interests, categories, and subcategories
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const fullStructure = req.query.full_structure === 'true';

    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (fullStructure) {
      // Return full nested structure: categories -> subcategories -> interests
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) {
        throw categoriesError;
      }

      const { data: subcategories, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('*')
        .order('name');

      if (subcategoriesError) {
        throw subcategoriesError;
      }

      const { data: interests, error: interestsError } = await supabase
        .from('interests')
        .select('*')
        .order('name');

      if (interestsError) {
        throw interestsError;
      }

      // Build nested structure
      const structure = categories.map(category => {
        const categorySubcategories = subcategories.filter(sc => sc.category_id === category.id);
        
        return {
          ...category,
          subcategories: categorySubcategories.map(subcategory => {
            const subcategoryInterests = interests.filter(i => i.subcategory_id === subcategory.id);
            return {
              ...subcategory,
              interests: subcategoryInterests
            };
          }),
          direct_interests: interests.filter(i => i.category_id === category.id && !i.subcategory_id)
        };
      });

      return res.status(200).json({
        success: true,
        categories: structure
      });
    } else {
      // Return simple list of all interests
      const { data: interests, error } = await supabase
        .from('interests')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        interests: interests || []
      });
    }
  } catch (error) {
    console.error('❌ Error fetching interests:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch interests',
      message: error.message
    });
  }
}

