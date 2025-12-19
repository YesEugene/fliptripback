/**
 * Analyze Locations - Check which locations have interests and categories
 * Temporary endpoint for analysis
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

    console.log('🔍 Analyzing locations in database...');

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
        total: 0,
        analysis: {}
      });
    }

    console.log(`📊 Found ${locations.length} locations`);

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
        if (analysis.sampleLocations.withInterests.length < 5) {
          analysis.sampleLocations.withInterests.push({
            id: location.id,
            name: location.name,
            interests: location.location_interests.map(li => li.interest?.name).filter(Boolean),
            category: location.category
          });
        }
      } else {
        analysis.withoutInterests++;
        if (analysis.sampleLocations.withoutInterests.length < 5) {
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
        
        if (analysis.sampleLocations.withCategory.length < 5) {
          analysis.sampleLocations.withCategory.push({
            id: location.id,
            name: location.name,
            category: location.category,
            hasInterests: hasInterests
          });
        }
      } else {
        analysis.withoutCategory++;
        if (analysis.sampleLocations.withoutCategory.length < 5) {
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

    console.log('✅ Analysis complete:', analysis);

    return res.status(200).json({
      success: true,
      message: `Analyzed ${analysis.total} locations`,
      analysis: analysis
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


