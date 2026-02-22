// Refresh expired Google Places photos for tour location blocks
// Re-fetches photos from Google Places API using stored place_id or name+address search

import { createClient } from '@supabase/supabase-js';
import { Client } from '@googlemaps/google-maps-services-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tourId, force } = req.body;

    if (!tourId) {
      return res.status(400).json({ error: 'tourId is required' });
    }

    if (!process.env.GOOGLE_MAPS_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_KEY not configured' });
    }

    console.log(`🔄 Refreshing photos for tour ${tourId} (force=${!!force})`);

    // Fetch all location blocks for this tour
    const { data: blocks, error: blocksError } = await supabase
      .from('tour_content_blocks')
      .select('*')
      .eq('tour_id', tourId)
      .eq('block_type', 'location');

    if (blocksError) {
      console.error('❌ Error fetching blocks:', blocksError);
      return res.status(500).json({ error: 'Failed to fetch location blocks' });
    }

    if (!blocks || blocks.length === 0) {
      return res.status(200).json({ success: true, message: 'No location blocks found', updated: 0 });
    }

    console.log(`📍 Found ${blocks.length} location block(s)`);

    let updatedCount = 0;
    const results = [];

    // Process all blocks in parallel to save time (Vercel has 10s timeout on hobby)
    const blockPromises = blocks.map(async (block) => {
      const content = JSON.parse(JSON.stringify(block.content || {})); // Deep copy
      let contentChanged = false;
      const blockResult = { blockId: block.id, locations: [] };

      // Collect all locations to refresh in parallel
      const locationRefreshTasks = [];

      if (content.mainLocation) {
        const needsRefresh = force || shouldRefreshPhotos(content.mainLocation);
        if (needsRefresh) {
          locationRefreshTasks.push({
            type: 'main',
            location: content.mainLocation
          });
        } else {
          blockResult.locations.push({ name: content.mainLocation.title || 'main', status: 'skipped', reason: 'recently refreshed or no Google photos' });
        }
      }

      if (content.alternativeLocations && Array.isArray(content.alternativeLocations)) {
        content.alternativeLocations.forEach((altLoc, i) => {
          const needsRefresh = force || shouldRefreshPhotos(altLoc);
          if (needsRefresh) {
            locationRefreshTasks.push({
              type: 'alt',
              index: i,
              location: altLoc
            });
          } else {
            blockResult.locations.push({ name: altLoc.title || `alt-${i}`, status: 'skipped', reason: 'recently refreshed or no Google photos' });
          }
        });
      }

      if (locationRefreshTasks.length === 0) {
        blockResult.success = true;
        blockResult.noChange = true;
        return blockResult;
      }

      // Process all location refreshes in parallel
      const refreshResults = await Promise.allSettled(
        locationRefreshTasks.map(task => refreshLocationPhotos(task.location))
      );

      // Apply results
      refreshResults.forEach((result, idx) => {
        const task = locationRefreshTasks[idx];
        const locName = task.location.title || task.location.name || `${task.type}-${task.index || 0}`;

        if (result.status === 'fulfilled' && result.value) {
          const refreshed = result.value;
          if (task.type === 'main') {
            content.mainLocation = { ...content.mainLocation, ...refreshed, _photosRefreshedAt: new Date().toISOString() };
          } else {
            content.alternativeLocations[task.index] = { ...content.alternativeLocations[task.index], ...refreshed, _photosRefreshedAt: new Date().toISOString() };
          }
          contentChanged = true;
          blockResult.locations.push({ name: locName, status: 'refreshed', photosCount: refreshed.photos?.length || 0 });
        } else {
          const reason = result.status === 'rejected' ? result.reason?.message : 'no photos found';
          blockResult.locations.push({ name: locName, status: 'failed', reason });
        }
      });

      if (contentChanged) {
        const { error: updateError } = await supabase
          .from('tour_content_blocks')
          .update({ content })
          .eq('id', block.id);

        if (updateError) {
          console.error(`❌ Error updating block ${block.id}:`, updateError);
          blockResult.success = false;
          blockResult.error = updateError.message;
        } else {
          blockResult.success = true;
          console.log(`✅ Updated block ${block.id}`);
        }
      } else {
        blockResult.success = true;
        blockResult.noChange = true;
      }

      return blockResult;
    });

    const blockResults = await Promise.allSettled(blockPromises);
    
    blockResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success && !result.value.noChange) updatedCount++;
      } else {
        results.push({ success: false, error: result.reason?.message });
      }
    });

    console.log(`✅ Refreshed photos: ${updatedCount}/${blocks.length} blocks updated`);
    console.log('📋 Detailed results:', JSON.stringify(results, null, 2));

    return res.status(200).json({
      success: true,
      updated: updatedCount,
      total: blocks.length,
      results
    });

  } catch (error) {
    console.error('❌ Error in refresh-tour-photos:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

/**
 * Check if a location needs photo refresh
 */
function shouldRefreshPhotos(location) {
  if (!location) return false;

  // If recently refreshed (within last hour), skip
  if (location._photosRefreshedAt) {
    const refreshedAt = new Date(location._photosRefreshedAt);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (refreshedAt > hourAgo) return false;
  }

  // Check if has Google Places photos
  return hasGooglePlacePhotos(location);
}

/**
 * Refresh photos for a single location
 * Uses multiple search strategies to find the place
 */
async function refreshLocationPhotos(location) {
  if (!location) return null;

  const locationName = location.title || location.name || '';
  const locationAddress = location.address || '';

  console.log(`🔍 Refreshing photos for: "${locationName}" at "${locationAddress}"`);

  try {
    let placeId = location.place_id;

    // If no stored place_id, try multiple strategies to find it
    if (!placeId) {
      placeId = await findPlaceIdWithFallbacks(locationName, locationAddress);
    }

    if (!placeId) {
      console.log(`⚠️ Could not find place_id for: "${locationName}"`);
      return null;
    }

    console.log(`✅ Found place_id: ${placeId} for "${locationName}"`);

    // Fetch fresh place details
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_KEY,
        language: 'en',
        fields: ['photos', 'place_id', 'name']
      }
    });

    if (response.data.status !== 'OK') {
      console.error(`❌ Places Details API error for "${locationName}":`, response.data.status, response.data.error_message);
      return null;
    }

    const place = response.data.result;

    if (!place.photos || place.photos.length === 0) {
      console.log(`📷 No photos available from Google Places for: "${locationName}"`);
      return null;
    }

    // Generate fresh photo URLs
    const freshPhotos = place.photos.slice(0, 10).map(photo =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
    );

    console.log(`📸 Got ${freshPhotos.length} fresh photos for: "${locationName}" (Google name: "${place.name}")`);

    return {
      photos: freshPhotos,
      photo: freshPhotos[0] || null,
      place_id: placeId
    };

  } catch (error) {
    console.error(`❌ Error refreshing photos for "${locationName}":`, error.message);
    return null;
  }
}

/**
 * Check if location has Google Places photo URLs
 */
function hasGooglePlacePhotos(location) {
  const checkUrl = (url) => url && typeof url === 'string' && url.includes('maps.googleapis.com/maps/api/place/photo');
  
  if (checkUrl(location.photo)) return true;
  if (Array.isArray(location.photos)) {
    return location.photos.some(p => checkUrl(p));
  }
  return false;
}

/**
 * Find place_id using multiple search strategies
 */
async function findPlaceIdWithFallbacks(name, address) {
  // Strategy 1: findPlaceFromText with just the name
  // This is often more reliable than combining name + full address
  if (name) {
    const result = await findPlaceFromText(name);
    if (result) {
      console.log(`  ✅ Strategy 1 (name only "${name}") found place_id: ${result}`);
      return result;
    }
  }

  // Strategy 2: findPlaceFromText with name + city from address
  if (name && address) {
    const city = extractCityFromAddress(address);
    if (city) {
      const result = await findPlaceFromText(`${name} ${city}`);
      if (result) {
        console.log(`  ✅ Strategy 2 (name+city "${name} ${city}") found place_id: ${result}`);
        return result;
      }
    }
  }

  // Strategy 3: findPlaceFromText with name + full address
  if (name && address) {
    const result = await findPlaceFromText(`${name} ${address}`);
    if (result) {
      console.log(`  ✅ Strategy 3 (name+address) found place_id: ${result}`);
      return result;
    }
  }

  // Strategy 4: textSearch with just the name + location bias from address
  if (name) {
    const result = await textSearchPlace(name, address);
    if (result) {
      console.log(`  ✅ Strategy 4 (textSearch "${name}") found place_id: ${result}`);
      return result;
    }
  }

  // Strategy 5: Try with just the address
  if (address) {
    const result = await findPlaceFromText(address);
    if (result) {
      console.log(`  ✅ Strategy 5 (address only) found place_id: ${result}`);
      return result;
    }
  }

  console.log(`  ❌ All strategies failed for: "${name}" at "${address}"`);
  return null;
}

/**
 * Extract city name from a full address string
 * e.g., "8 Av. du Mahatma Gandhi, 75116 Paris, France" → "Paris"
 */
function extractCityFromAddress(address) {
  if (!address) return null;
  
  // Common patterns: "..., City, Country" or "..., PostalCode City, Country"
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Try second-to-last part (usually city or postal+city)
    const cityPart = parts[parts.length - 2];
    // Remove postal code if present (digits at the start)
    const cleaned = cityPart.replace(/^\d+\s*/, '').trim();
    if (cleaned && cleaned.length > 1) return cleaned;
  }
  
  return null;
}

/**
 * Find place using findPlaceFromText API
 */
async function findPlaceFromText(query) {
  try {
    if (!query || query.trim().length < 2) return null;

    const response = await googleMapsClient.findPlaceFromText({
      params: {
        input: query.trim(),
        inputtype: 'textquery',
        key: process.env.GOOGLE_MAPS_KEY,
        fields: ['place_id', 'name']
      }
    });

    if (response.data.status === 'OK' && response.data.candidates && response.data.candidates.length > 0) {
      return response.data.candidates[0].place_id;
    }

    return null;
  } catch (error) {
    console.error(`  ⚠️ findPlaceFromText failed for "${query}":`, error.message);
    return null;
  }
}

/**
 * Find place using textSearch API (more fuzzy search)
 */
async function textSearchPlace(name, address) {
  try {
    if (!name) return null;

    const city = extractCityFromAddress(address);
    const query = city ? `${name} in ${city}` : name;

    const response = await googleMapsClient.textSearch({
      params: {
        query: query,
        key: process.env.GOOGLE_MAPS_KEY,
        // type: 'establishment' // Don't restrict type to increase chances
      }
    });

    if (response.data.status === 'OK' && response.data.results && response.data.results.length > 0) {
      return response.data.results[0].place_id;
    }

    return null;
  } catch (error) {
    console.error(`  ⚠️ textSearch failed for "${name}":`, error.message);
    return null;
  }
}
