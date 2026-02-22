// Refresh expired Google Places photos for tour location blocks
// Re-fetches photos from Google Places API using stored place_id or name+address search

import { supabase } from '../database/db.js';
import { Client } from '@googlemaps/google-maps-services-js';

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

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
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
      return res.status(500).json({ error: 'Failed to fetch location blocks', details: blocksError.message });
    }

    if (!blocks || blocks.length === 0) {
      return res.status(200).json({ success: true, message: 'No location blocks found', updated: 0 });
    }

    console.log(`📍 Found ${blocks.length} location block(s)`);

    let updatedCount = 0;
    const results = [];

    // Process blocks sequentially to avoid rate limits and timeout issues
    for (const block of blocks) {
      const content = JSON.parse(JSON.stringify(block.content || {})); // Deep copy
      let contentChanged = false;
      const blockResult = { blockId: block.id, locations: [] };

      // Refresh main location photos
      if (content.mainLocation) {
        const needsRefresh = force || shouldRefreshPhotos(content.mainLocation);
        if (needsRefresh) {
          try {
            const refreshed = await refreshLocationPhotos(content.mainLocation);
            if (refreshed) {
              content.mainLocation = { ...content.mainLocation, ...refreshed, _photosRefreshedAt: new Date().toISOString() };
              contentChanged = true;
              blockResult.locations.push({ name: content.mainLocation.title || 'main', status: 'refreshed', photosCount: refreshed.photos?.length || 0 });
            } else {
              blockResult.locations.push({ name: content.mainLocation.title || 'main', status: 'failed', reason: 'no photos found or search failed' });
            }
          } catch (err) {
            console.error(`❌ Error refreshing main location:`, err.message);
            blockResult.locations.push({ name: content.mainLocation.title || 'main', status: 'error', reason: err.message });
          }
        } else {
          blockResult.locations.push({ name: content.mainLocation.title || 'main', status: 'skipped' });
        }
      }

      // Refresh alternative location photos
      if (content.alternativeLocations && Array.isArray(content.alternativeLocations)) {
        for (let i = 0; i < content.alternativeLocations.length; i++) {
          const altLoc = content.alternativeLocations[i];
          const needsRefresh = force || shouldRefreshPhotos(altLoc);
          if (needsRefresh) {
            try {
              const refreshed = await refreshLocationPhotos(altLoc);
              if (refreshed) {
                content.alternativeLocations[i] = { ...altLoc, ...refreshed, _photosRefreshedAt: new Date().toISOString() };
                contentChanged = true;
                blockResult.locations.push({ name: altLoc.title || `alt-${i}`, status: 'refreshed', photosCount: refreshed.photos?.length || 0 });
              } else {
                blockResult.locations.push({ name: altLoc.title || `alt-${i}`, status: 'failed', reason: 'no photos found or search failed' });
              }
            } catch (err) {
              console.error(`❌ Error refreshing alt location ${i}:`, err.message);
              blockResult.locations.push({ name: altLoc.title || `alt-${i}`, status: 'error', reason: err.message });
            }
          } else {
            blockResult.locations.push({ name: altLoc.title || `alt-${i}`, status: 'skipped' });
          }
        }
      }

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
          updatedCount++;
          blockResult.success = true;
          console.log(`✅ Updated block ${block.id}`);
        }
      } else {
        blockResult.success = true;
        blockResult.noChange = true;
      }

      results.push(blockResult);
    }

    console.log(`✅ Refreshed photos: ${updatedCount}/${blocks.length} blocks updated`);

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

  // If recently refreshed (within last 30 days), skip
  // Google Place photo references are stable for months — no need to refresh often
  if (location._photosRefreshedAt) {
    const refreshedAt = new Date(location._photosRefreshedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (refreshedAt > thirtyDaysAgo) return false;
  }

  return hasGooglePlacePhotos(location);
}

/**
 * Refresh photos for a single location
 * Uses multiple search strategies to find the place
 * Downloads photos and caches them in Supabase Storage to avoid repeated Google API billing
 */
async function refreshLocationPhotos(location) {
  if (!location) return null;

  const locationName = location.title || location.name || '';
  const locationAddress = location.address || '';

  console.log(`🔍 Refreshing photos for: "${locationName}" at "${locationAddress}"`);

  let placeId = location.place_id;

  // If no stored place_id, try multiple strategies to find it
  if (!placeId) {
    placeId = await findPlaceIdWithFallbacks(locationName, locationAddress);
  }

  if (!placeId) {
    console.log(`⚠️ Could not find place_id for: "${locationName}"`);
    return null;
  }

  console.log(`✅ Using place_id: ${placeId} for "${locationName}"`);

  // Fetch fresh place details (only photos + place_id to minimize cost)
  const response = await googleMapsClient.placeDetails({
    params: {
      place_id: placeId,
      key: process.env.GOOGLE_MAPS_KEY,
      language: 'en',
      fields: ['photos', 'place_id']
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

  // Download photos from Google and cache in Supabase Storage
  // This way each photo is fetched from Google only ONCE, then served free from Supabase
  const photoRefs = place.photos.slice(0, 5); // Limit to 5 photos to save costs
  const cachedPhotos = [];

  for (const photoData of photoRefs) {
    try {
      const cachedUrl = await cachePhotoInSupabase(placeId, photoData.photo_reference);
      if (cachedUrl) {
        cachedPhotos.push(cachedUrl);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to cache photo for "${locationName}":`, err.message);
      // Fallback: use direct Google URL (will still be billed per view)
      cachedPhotos.push(
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoData.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
      );
    }
  }

  console.log(`📸 Got ${cachedPhotos.length} photos for: "${locationName}" (${cachedPhotos.filter(u => u.includes('supabase')).length} cached)`);

  return {
    photos: cachedPhotos,
    photo: cachedPhotos[0] || null,
    place_id: placeId
  };
}

/**
 * Download a Google Place photo and cache it in Supabase Storage
 * Returns the public Supabase URL, or null if caching fails
 */
async function cachePhotoInSupabase(placeId, photoReference) {
  if (!supabase || !placeId || !photoReference) return null;

  const fileName = `place-photos/${placeId}/${photoReference.substring(0, 40)}.jpg`;

  // Check if photo already exists in storage
  const { data: existingFile } = await supabase.storage
    .from('tour-assets')
    .createSignedUrl(fileName, 60); // Just checking if it exists

  // Try to get public URL first — if file exists, return it immediately
  const { data: publicUrlData } = supabase.storage
    .from('tour-assets')
    .getPublicUrl(fileName);

  if (publicUrlData?.publicUrl) {
    // Verify file actually exists by checking with list
    const dirPath = `place-photos/${placeId}`;
    const fileBaseName = `${photoReference.substring(0, 40)}.jpg`;
    const { data: files } = await supabase.storage
      .from('tour-assets')
      .list(dirPath, { limit: 100 });

    if (files && files.some(f => f.name === fileBaseName)) {
      console.log(`  ♻️ Photo already cached: ${fileBaseName}`);
      return publicUrlData.publicUrl;
    }
  }

  // Download photo from Google
  const googlePhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${process.env.GOOGLE_MAPS_KEY}`;

  const photoResponse = await fetch(googlePhotoUrl, { redirect: 'follow' });
  if (!photoResponse.ok) {
    console.warn(`  ❌ Failed to download photo from Google: ${photoResponse.status}`);
    return null;
  }

  const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
  const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('tour-assets')
    .upload(fileName, photoBuffer, {
      contentType,
      upsert: true // Overwrite if exists
    });

  if (uploadError) {
    console.warn(`  ❌ Failed to upload photo to Supabase: ${uploadError.message}`);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('tour-assets')
    .getPublicUrl(fileName);

  console.log(`  ✅ Cached photo: ${fileName}`);
  return urlData?.publicUrl || null;
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
  console.log(`  🔎 Searching place_id for: name="${name}", address="${address}"`);
  
  // Strategy 1: Just the name (most reliable for well-known places)
  if (name) {
    try {
      const result = await findPlaceFromText(name);
      if (result) {
        console.log(`  ✅ Strategy 1 (name only) found: ${result}`);
        return result;
      }
    } catch (e) {
      console.log(`  ⚠️ Strategy 1 failed: ${e.message}`);
    }
  }

  // Strategy 2: Name + city extracted from address
  if (name && address) {
    const city = extractCityFromAddress(address);
    if (city) {
      try {
        const result = await findPlaceFromText(`${name} ${city}`);
        if (result) {
          console.log(`  ✅ Strategy 2 (name+city) found: ${result}`);
          return result;
        }
      } catch (e) {
        console.log(`  ⚠️ Strategy 2 failed: ${e.message}`);
      }
    }
  }

  // Strategy 3: Name + full address
  if (name && address) {
    try {
      const result = await findPlaceFromText(`${name}, ${address}`);
      if (result) {
        console.log(`  ✅ Strategy 3 (name+address) found: ${result}`);
        return result;
      }
    } catch (e) {
      console.log(`  ⚠️ Strategy 3 failed: ${e.message}`);
    }
  }

  // Strategy 4: Text search (more fuzzy)
  if (name) {
    try {
      const city = extractCityFromAddress(address);
      const query = city ? `${name} in ${city}` : name;
      const response = await googleMapsClient.textSearch({
        params: {
          query: query,
          key: process.env.GOOGLE_MAPS_KEY
        }
      });
      if (response.data.status === 'OK' && response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0].place_id;
        console.log(`  ✅ Strategy 4 (textSearch) found: ${result}`);
        return result;
      }
    } catch (e) {
      console.log(`  ⚠️ Strategy 4 failed: ${e.message}`);
    }
  }

  // Strategy 5: Just the address
  if (address) {
    try {
      const result = await findPlaceFromText(address);
      if (result) {
        console.log(`  ✅ Strategy 5 (address only) found: ${result}`);
        return result;
      }
    } catch (e) {
      console.log(`  ⚠️ Strategy 5 failed: ${e.message}`);
    }
  }

  console.log(`  ❌ All 5 strategies failed for: "${name}" at "${address}"`);
  return null;
}

/**
 * Extract city name from a full address string
 */
function extractCityFromAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2];
    const cleaned = cityPart.replace(/^\d+\s*/, '').trim();
    if (cleaned && cleaned.length > 1) return cleaned;
  }
  return null;
}

/**
 * Find place using findPlaceFromText API
 */
async function findPlaceFromText(query) {
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
}
