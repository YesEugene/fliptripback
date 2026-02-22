// Refresh expired Google Places photos for tour location blocks
// Re-fetches photos from Google Places API using stored place_id or name+address search

import { createClient } from '@supabase/supabase-js';
import { Client } from '@googlemaps/google-maps-services-js';
import cors from 'cors';

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
    const { tourId } = req.body;

    if (!tourId) {
      return res.status(400).json({ error: 'tourId is required' });
    }

    if (!process.env.GOOGLE_MAPS_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_KEY not configured' });
    }

    console.log(`🔄 Refreshing photos for tour ${tourId}`);

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

    for (const block of blocks) {
      const content = block.content || {};
      let contentChanged = false;

      // Refresh main location photos
      if (content.mainLocation) {
        const refreshed = await refreshLocationPhotos(content.mainLocation);
        if (refreshed) {
          content.mainLocation = { ...content.mainLocation, ...refreshed };
          contentChanged = true;
        }
      }

      // Refresh alternative location photos
      if (content.alternativeLocations && Array.isArray(content.alternativeLocations)) {
        for (let i = 0; i < content.alternativeLocations.length; i++) {
          const altLoc = content.alternativeLocations[i];
          const refreshed = await refreshLocationPhotos(altLoc);
          if (refreshed) {
            content.alternativeLocations[i] = { ...altLoc, ...refreshed };
            contentChanged = true;
          }
        }
      }

      if (contentChanged) {
        // Save updated content back to database
        const { error: updateError } = await supabase
          .from('tour_content_blocks')
          .update({ content })
          .eq('id', block.id);

        if (updateError) {
          console.error(`❌ Error updating block ${block.id}:`, updateError);
          results.push({ blockId: block.id, success: false, error: updateError.message });
        } else {
          updatedCount++;
          results.push({ blockId: block.id, success: true });
          console.log(`✅ Updated block ${block.id}`);
        }
      } else {
        results.push({ blockId: block.id, success: true, noChange: true });
      }
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
 * Refresh photos for a single location
 * Tries: 1) place_id, 2) name + address search
 * Returns updated fields or null if no refresh needed/possible
 */
async function refreshLocationPhotos(location) {
  if (!location) return null;

  // Check if photos are Google Places URLs that need refreshing
  const hasGooglePhotos = hasGooglePlacePhotos(location);
  
  // If no Google Places photos at all, nothing to refresh
  if (!hasGooglePhotos && !location.place_id) return null;

  const locationName = location.title || location.name || '';
  const locationAddress = location.address || '';

  console.log(`🔍 Refreshing photos for: ${locationName} (${locationAddress})`);

  try {
    let placeId = location.place_id;

    // If no place_id, try to find it via text search
    if (!placeId && (locationName || locationAddress)) {
      placeId = await findPlaceId(locationName, locationAddress);
    }

    if (!placeId) {
      console.log(`⚠️ Could not find place_id for: ${locationName}`);
      return null;
    }

    // Fetch fresh place details
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_KEY,
        language: 'en',
        fields: ['photos', 'place_id']
      }
    });

    if (response.data.status !== 'OK') {
      console.error(`❌ Places API error for ${locationName}:`, response.data.status);
      return null;
    }

    const place = response.data.result;

    if (!place.photos || place.photos.length === 0) {
      console.log(`📷 No photos available for: ${locationName}`);
      return null;
    }

    // Generate fresh photo URLs
    const freshPhotos = place.photos.slice(0, 10).map(photo =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
    );

    console.log(`📸 Got ${freshPhotos.length} fresh photos for: ${locationName}`);

    return {
      photos: freshPhotos,
      photo: freshPhotos[0] || null,
      place_id: placeId // Save place_id for future refreshes
    };

  } catch (error) {
    console.error(`❌ Error refreshing photos for ${locationName}:`, error.message);
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
 * Find place_id by searching for location name and address
 */
async function findPlaceId(name, address) {
  try {
    const query = `${name} ${address}`.trim();
    if (!query) return null;

    const response = await googleMapsClient.findPlaceFromText({
      params: {
        input: query,
        inputtype: 'textquery',
        key: process.env.GOOGLE_MAPS_KEY,
        fields: ['place_id']
      }
    });

    if (response.data.status === 'OK' && response.data.candidates && response.data.candidates.length > 0) {
      return response.data.candidates[0].place_id;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error finding place_id for "${name}":`, error.message);
    return null;
  }
}
