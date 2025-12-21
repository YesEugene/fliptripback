/**
 * Add Interests to All Locations
 * 
 * This script adds interests to all locations based on their category
 * using the mapping: location.category -> interest category -> interests
 * 
 * IMPORTANT: Only adds interests, doesn't remove existing ones
 * 
 * Run: node scripts/add-interests-to-locations.js
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
      console.log(`⚠️ No interest category found for: ${categoryName}`);
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

async function addInterestsToLocations() {
  try {
    if (!supabase) {
      console.error('❌ Database not configured');
      console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
      process.exit(1);
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
      process.exit(1);
    }

    if (!locations || locations.length === 0) {
      console.log('⚠️ No locations found in database');
      return;
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

    for (const location of locations) {
      try {
        // Skip if location has no category
        if (!location.category || location.category.trim() === '') {
          console.log(`⏭️  Skipping "${location.name}" - no category`);
          skippedCount++;
          continue;
        }

        const locCategory = location.category.toLowerCase().trim();
        const mappedInterests = categoryInterestMap.get(locCategory);

        if (!mappedInterests || mappedInterests.length === 0) {
          console.log(`⏭️  Skipping "${location.name}" - no interests mapped for category "${locCategory}"`);
          skippedCount++;
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
          console.log(`✓  "${location.name}" - already has all interests from category "${locCategory}"`);
          skippedCount++;
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
        } else {
          console.log(`✅ "${location.name}" - added ${interestsToAdd.length} interest(s) from category "${locCategory}"`);
          addedCount += interestsToAdd.length;
          processedCount++;
        }

      } catch (locationError) {
        console.error(`❌ Unexpected error processing "${location.name}":`, locationError);
        errors.push({ location: location.name, error: locationError.message });
        errorCount++;
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

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`  - ${err.location}: ${err.error}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Script completed!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

addInterestsToLocations();



