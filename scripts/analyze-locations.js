/**
 * Analyze Locations - Check which locations have interests and categories
 * Run: node scripts/analyze-locations.js
 */

import { supabase } from '../database/db.js';

async function analyzeLocations() {
  try {
    if (!supabase) {
      console.error('❌ Database not configured');
      console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
      process.exit(1);
    }

    console.log('🔍 Analyzing locations in database...\n');

    // Get all locations with their interests
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select(`
        id,
        name,
        category,
        city_id,
        location_interests(
          interest:interests(
            id,
            name,
            category_id
          )
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

    // Analyze locations
    const analysis = {
      total: locations.length,
      withInterests: 0,
      withoutInterests: 0,
      withCategory: 0,
      withoutCategory: 0,
      withBoth: 0,
      withNeither: 0,
      interestsCount: {},
      categoriesCount: {},
      sampleLocations: {
        withInterests: [],
        withoutInterests: [],
        withCategory: [],
        withoutCategory: []
      }
    };

    locations.forEach(location => {
      const hasInterests = location.location_interests && 
                          Array.isArray(location.location_interests) && 
                          location.location_interests.length > 0;
      const hasCategory = location.category && location.category.trim() !== '';

      if (hasInterests) {
        analysis.withInterests++;
        
        // Count interests per location
        const interestCount = location.location_interests.length;
        analysis.interestsCount[interestCount] = (analysis.interestsCount[interestCount] || 0) + 1;
        
        // Store sample
        if (analysis.sampleLocations.withInterests.length < 10) {
          analysis.sampleLocations.withInterests.push({
            id: location.id,
            name: location.name,
            interests: location.location_interests.map(li => li.interest?.name).filter(Boolean),
            category: location.category
          });
        }
      } else {
        analysis.withoutInterests++;
        if (analysis.sampleLocations.withoutInterests.length < 10) {
          analysis.sampleLocations.withoutInterests.push({
            id: location.id,
            name: location.name,
            category: location.category
          });
        }
      }

      if (hasCategory) {
        analysis.withCategory++;
        analysis.categoriesCount[location.category] = (analysis.categoriesCount[location.category] || 0) + 1;
        
        if (analysis.sampleLocations.withCategory.length < 10) {
          analysis.sampleLocations.withCategory.push({
            id: location.id,
            name: location.name,
            category: location.category,
            hasInterests: hasInterests
          });
        }
      } else {
        analysis.withoutCategory++;
        if (analysis.sampleLocations.withoutCategory.length < 10) {
          analysis.sampleLocations.withoutCategory.push({
            id: location.id,
            name: location.name,
            hasInterests: hasInterests
          });
        }
      }

      if (hasInterests && hasCategory) {
        analysis.withBoth++;
      }

      if (!hasInterests && !hasCategory) {
        analysis.withNeither++;
      }
    });

    // Calculate percentages
    analysis.percentages = {
      withInterests: ((analysis.withInterests / analysis.total) * 100).toFixed(2) + '%',
      withoutInterests: ((analysis.withoutInterests / analysis.total) * 100).toFixed(2) + '%',
      withCategory: ((analysis.withCategory / analysis.total) * 100).toFixed(2) + '%',
      withoutCategory: ((analysis.withoutCategory / analysis.total) * 100).toFixed(2) + '%',
      withBoth: ((analysis.withBoth / analysis.total) * 100).toFixed(2) + '%',
      withNeither: ((analysis.withNeither / analysis.total) * 100).toFixed(2) + '%'
    };

    // Print results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 LOCATIONS ANALYSIS RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total locations: ${analysis.total}\n`);
    
    console.log('📈 Statistics:');
    console.log(`  ✅ With interests: ${analysis.withInterests} (${analysis.percentages.withInterests})`);
    console.log(`  ❌ Without interests: ${analysis.withoutInterests} (${analysis.percentages.withoutInterests})`);
    console.log(`  ✅ With category: ${analysis.withCategory} (${analysis.percentages.withCategory})`);
    console.log(`  ❌ Without category: ${analysis.withoutCategory} (${analysis.percentages.withoutCategory})`);
    console.log(`  ✅ With both (interests + category): ${analysis.withBoth} (${analysis.percentages.withBoth})`);
    console.log(`  ❌ With neither: ${analysis.withNeither} (${analysis.percentages.withNeither})\n`);

    if (Object.keys(analysis.interestsCount).length > 0) {
      console.log('📊 Interests distribution (how many interests per location):');
      Object.entries(analysis.interestsCount)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([count, locations]) => {
          console.log(`  ${count} interest(s): ${locations} location(s)`);
        });
      console.log('');
    }

    if (Object.keys(analysis.categoriesCount).length > 0) {
      console.log('📊 Categories distribution:');
      Object.entries(analysis.categoriesCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          console.log(`  ${category}: ${count} location(s)`);
        });
      console.log('');
    }

    if (analysis.sampleLocations.withInterests.length > 0) {
      console.log('✅ Sample locations WITH interests:');
      analysis.sampleLocations.withInterests.forEach(loc => {
        console.log(`  - ${loc.name}`);
        console.log(`    Interests: ${loc.interests.join(', ')}`);
        console.log(`    Category: ${loc.category || 'N/A'}`);
      });
      console.log('');
    }

    if (analysis.sampleLocations.withoutInterests.length > 0) {
      console.log('❌ Sample locations WITHOUT interests:');
      analysis.sampleLocations.withoutInterests.forEach(loc => {
        console.log(`  - ${loc.name}`);
        console.log(`    Category: ${loc.category || 'N/A'}`);
      });
      console.log('');
    }

    if (analysis.sampleLocations.withCategory.length > 0) {
      console.log('✅ Sample locations WITH category:');
      analysis.sampleLocations.withCategory.forEach(loc => {
        console.log(`  - ${loc.name}`);
        console.log(`    Category: ${loc.category}`);
        console.log(`    Has interests: ${loc.hasInterests ? 'Yes' : 'No'}`);
      });
      console.log('');
    }

    if (analysis.sampleLocations.withoutCategory.length > 0) {
      console.log('❌ Sample locations WITHOUT category:');
      analysis.sampleLocations.withoutCategory.forEach(loc => {
        console.log(`  - ${loc.name}`);
        console.log(`    Has interests: ${loc.hasInterests ? 'Yes' : 'No'}`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Analysis complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

analyzeLocations();

