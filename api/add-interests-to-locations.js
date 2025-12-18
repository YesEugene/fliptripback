/**
 * Add Interests to All Locations API
 * 
 * This endpoint adds interests to all locations based on their category
 * using the mapping: location.category -> interest category -> interests
 * 
 * IMPORTANT: Only adds interests, doesn't remove existing ones
 * 
 * POST /api/add-interests-to-locations
 */

import { supabase } from '../database/db.js';

// Mapping from location.category to interest category names
const LOCATION_CATEGORY_TO_INTEREST_CATEGORY = {
  // Active
  'activity': 'active',
  'sports': 'active',
  'adventure': 'active',
  
  // Culture
  'museum': 'culture',
  'monument': 'culture',
  'theater': 'culture',
  'landmark': 'culture',
  'neighborhood': 'culture',
  
  // Food
  'restaurant': 'food',
  'cafe': 'food',
  'bar': 'food',
  'market': 'food',
  
  // Nature
  'park': 'nature',
  'beach': 'nature',
  
  // Nightlife
  'nightlife': 'nightlife',
  
  // Health
  'wellness': 'health',
  
  // Unique Experiences
  'shopping': 'unique',
  'accommodation': 'unique',
  'transport': 'unique',
  'other': 'unique'
};

async function getInterestsByCategoryName(categoryName, supabaseClient) {
  try {
    // Get category by name (case-insensitive)
    const { data: categories } = await supabaseClient
      .from('interest_categories')
      .select('id, name')
      .ilike('name', categoryName);
    
    if (!categories || categories.length === 0) {
      return [];
    }
    
    // Get all interests from this category (both direct and from subcategories)
    const categoryIds = categories.map(c => c.id);
    const { data: interests } = await supabaseClient
      .from('interests')
      .select('id, name')
      .in('category_id', categoryIds);
    
    if (interests && interests.length > 0) {
      return interests;
    }
    
    return [];
  } catch (error) {
    console.error(`❌ Error getting interests for category ${categoryName}:`, error);
    return [];
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    console.log('🔍 Loading all locations from database...\n');

    // Get all locations with their existing interests
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select(`
        id,
        name,
        category,
        location_interests(
          interest_id
        )
      `)
      .order('name');

    if (locationsError) {
      console.error('❌ Error fetching locations:', locationsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch locations',
        message: locationsError.message
      });
    }

    if (!locations || locations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No locations found',
        results: {
          total: 0,
          processed: 0,
          skipped: 0,
          added: 0,
          errors: 0
        }
      });
    }

    console.log(`📊 Found ${locations.length} locations\n`);

    // Pre-load all interest categories and their interests
    console.log('📋 Loading interest categories and interests...');
    const categoryInterestMap = new Map(); // category name -> array of interest objects
    
    for (const [locCategory, interestCategoryName] of Object.entries(LOCATION_CATEGORY_TO_INTEREST_CATEGORY)) {
      const interests = await getInterestsByCategoryName(interestCategoryName, supabase);
      if (interests.length > 0) {
        categoryInterestMap.set(locCategory, interests);
        console.log(`  ✅ ${locCategory} -> ${interestCategoryName}: ${interests.length} interests`);
      }
    }
    console.log('');

    let processedCount = 0;
    let skippedCount = 0;
    let addedCount = 0;
    let errorCount = 0;
    const errors = [];
    const details = [];

    for (const location of locations) {
      try {
        // Skip if location has no category
        if (!location.category || location.category.trim() === '') {
          skippedCount++;
          details.push({ location: location.name, action: 'skipped', reason: 'no category' });
          continue;
        }

        const locCategory = location.category.toLowerCase().trim();
        const mappedInterests = categoryInterestMap.get(locCategory);

        if (!mappedInterests || mappedInterests.length === 0) {
          skippedCount++;
          details.push({ location: location.name, action: 'skipped', reason: `no interests mapped for category "${locCategory}"` });
          continue;
        }

        // Get existing interest IDs for this location
        const existingInterestIds = new Set(
          (location.location_interests || []).map(li => li.interest_id)
        );

        // Find interests to add (not already present)
        const interestsToAdd = mappedInterests.filter(interest => 
          !existingInterestIds.has(interest.id)
        );

        if (interestsToAdd.length === 0) {
          skippedCount++;
          details.push({ location: location.name, action: 'skipped', reason: 'already has all interests' });
          continue;
        }

        // Insert new location_interests
        const interestInserts = interestsToAdd.map(interest => ({
          location_id: location.id,
          interest_id: interest.id
        }));

        const { error: insertError } = await supabase
          .from('location_interests')
          .insert(interestInserts);

        if (insertError) {
          console.error(`❌ Error adding interests to "${location.name}":`, insertError);
          errors.push({ location: location.name, error: insertError.message });
          errorCount++;
          details.push({ location: location.name, action: 'error', error: insertError.message });
        } else {
          console.log(`✅ "${location.name}" - added ${interestsToAdd.length} interest(s) from category "${locCategory}"`);
          addedCount += interestsToAdd.length;
          processedCount++;
          details.push({ 
            location: location.name, 
            action: 'added', 
            count: interestsToAdd.length,
            category: locCategory
          });
        }

      } catch (locationError) {
        console.error(`❌ Unexpected error processing "${location.name}":`, locationError);
        errors.push({ location: location.name, error: locationError.message });
        errorCount++;
        details.push({ location: location.name, action: 'error', error: locationError.message });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total locations: ${locations.length}`);
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`➕ Interests added: ${addedCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    return res.status(200).json({
      success: true,
      message: `Processed ${locations.length} locations`,
      results: {
        total: locations.length,
        processed: processedCount,
        skipped: skippedCount,
        added: addedCount,
        errors: errorCount,
        errorDetails: errors
      },
      details: details.slice(0, 50) // Limit details to first 50 for response size
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

