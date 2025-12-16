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

    console.log('📋 Interests API called:', { fullStructure, hasSupabase: !!supabase });
    
    if (!supabase) {
      console.error('❌ Supabase not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
      return res.status(500).json({
        success: false,
        error: 'Database not configured',
        message: 'Supabase credentials missing. Please check environment variables.'
      });
    }

    if (fullStructure) {
      // Return full nested structure: categories -> subcategories -> interests
      // Note: Using interest_categories and interest_subcategories (not categories/subcategories)
      console.log('📋 Fetching full structure from Supabase...');
      
      const { data: categories, error: categoriesError } = await supabase
        .from('interest_categories')
        .select('*')
        .order('name');

      if (categoriesError) {
        console.error('❌ Error fetching categories:', categoriesError);
        throw categoriesError;
      }
      
      console.log(`✅ Fetched ${categories?.length || 0} categories`);

      const { data: subcategories, error: subcategoriesError } = await supabase
        .from('interest_subcategories')
        .select('*')
        .order('name');

      if (subcategoriesError) {
        console.error('❌ Error fetching subcategories:', subcategoriesError);
        throw subcategoriesError;
      }
      
      console.log(`✅ Fetched ${subcategories?.length || 0} subcategories`);

      const { data: interests, error: interestsError } = await supabase
        .from('interests')
        .select('*')
        .order('name');

      if (interestsError) {
        console.error('❌ Error fetching interests:', interestsError);
        throw interestsError;
      }
      
      console.log(`✅ Fetched ${interests?.length || 0} interests`);

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
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch interests',
      message: error.message || 'Unknown error',
      details: error.details || null,
      hint: error.hint || null
    });
  }
}

