// Mass migration: cache ALL Google Places photos to Supabase Storage
// Run once to eliminate ongoing Google Places Photo API costs
// After this, all photos will be served from Supabase (free)

import { supabase } from '../database/db.js';
import { Client } from '@googlemaps/google-maps-services-js';

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    if (!process.env.GOOGLE_MAPS_KEY) return res.status(500).json({ error: 'GOOGLE_MAPS_KEY not configured' });

    // Optional: pass specific tourId, or process all tours
    const { tourId, limit: batchLimit } = req.body || {};
    const maxBlocks = batchLimit || 3; // Process up to 3 blocks per call (Vercel 10s timeout)

    console.log(`🚀 Mass photo migration started (tourId=${tourId || 'ALL'}, limit=${maxBlocks})`);

    // Fetch location blocks that still have Google Places photo URLs
    let query = supabase
      .from('tour_content_blocks')
      .select('id, tour_id, content, block_type')
      .eq('block_type', 'location')
      .limit(500); // Fetch up to 500 to find the ones that need migration

    if (tourId) {
      query = query.eq('tour_id', tourId);
    }

    const { data: allBlocks, error: blocksError } = await query;

    if (blocksError) {
      console.error('❌ Error fetching blocks:', blocksError);
      return res.status(500).json({ error: 'Failed to fetch blocks', details: blocksError.message });
    }

    if (!allBlocks || allBlocks.length === 0) {
      return res.status(200).json({ success: true, message: 'No location blocks found', stats: { total: 0 } });
    }

    // Filter blocks that have Google Places photo URLs (not yet migrated)
    const blocksNeedingMigration = allBlocks.filter(block => {
      const content = block.content || {};
      return locationHasGooglePhotos(content.mainLocation) ||
             (content.alternativeLocations || []).some(alt => locationHasGooglePhotos(alt));
    });

    console.log(`📊 Found ${allBlocks.length} location blocks total, ${blocksNeedingMigration.length} need migration`);

    if (blocksNeedingMigration.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'All photos already migrated!', 
        stats: { total: allBlocks.length, needsMigration: 0, migrated: 0 } 
      });
    }

    // Process only up to maxBlocks to avoid timeout
    const blocksToProcess = blocksNeedingMigration.slice(0, maxBlocks);
    let migratedCount = 0;
    let photosDownloaded = 0;
    let photosCachedFromExisting = 0;
    let errors = [];

    for (const block of blocksToProcess) {
      const content = JSON.parse(JSON.stringify(block.content || {}));
      let changed = false;

      // Migrate main location
      if (content.mainLocation && locationHasGooglePhotos(content.mainLocation)) {
        try {
          const result = await migrateLocationPhotos(content.mainLocation);
          if (result) {
            content.mainLocation.photos = result.photos;
            content.mainLocation.photo = result.photos[0] || content.mainLocation.photo;
            content.mainLocation._photosRefreshedAt = new Date().toISOString();
            changed = true;
            photosDownloaded += result.downloaded;
            photosCachedFromExisting += result.cached;
            console.log(`  ✅ Main: ${content.mainLocation.title || 'unnamed'} — ${result.photos.length} photos`);
          }
        } catch (err) {
          console.error(`  ❌ Main location error:`, err.message);
          errors.push({ block: block.id, location: content.mainLocation.title, error: err.message });
        }
      }

      // Migrate alternative locations
      if (content.alternativeLocations && Array.isArray(content.alternativeLocations)) {
        for (let i = 0; i < content.alternativeLocations.length; i++) {
          const alt = content.alternativeLocations[i];
          if (locationHasGooglePhotos(alt)) {
            try {
              const result = await migrateLocationPhotos(alt);
              if (result) {
                content.alternativeLocations[i].photos = result.photos;
                content.alternativeLocations[i].photo = result.photos[0] || alt.photo;
                content.alternativeLocations[i]._photosRefreshedAt = new Date().toISOString();
                changed = true;
                photosDownloaded += result.downloaded;
                photosCachedFromExisting += result.cached;
                console.log(`  ✅ Alt ${i}: ${alt.title || 'unnamed'} — ${result.photos.length} photos`);
              }
            } catch (err) {
              console.error(`  ❌ Alt location ${i} error:`, err.message);
              errors.push({ block: block.id, location: alt.title, error: err.message });
            }
          }
        }
      }

      if (changed) {
        const { error: updateError } = await supabase
          .from('tour_content_blocks')
          .update({ content })
          .eq('id', block.id);

        if (updateError) {
          console.error(`❌ DB update failed for block ${block.id}:`, updateError.message);
          errors.push({ block: block.id, error: `DB update: ${updateError.message}` });
        } else {
          migratedCount++;
        }
      }
    }

    const stats = {
      totalBlocks: allBlocks.length,
      needsMigration: blocksNeedingMigration.length,
      processedThisBatch: blocksToProcess.length,
      migratedBlocks: migratedCount,
      photosDownloaded,
      photosCachedFromExisting,
      errorsCount: errors.length,
      remainingBlocks: blocksNeedingMigration.length - blocksToProcess.length
    };

    console.log(`✅ Migration batch complete:`, stats);

    return res.status(200).json({
      success: true,
      message: stats.remainingBlocks > 0 
        ? `Migrated ${migratedCount} blocks. ${stats.remainingBlocks} remaining — call again to continue.`
        : `Migration complete! ${migratedCount} blocks migrated.`,
      stats,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return res.status(500).json({ error: 'Migration failed', message: error.message });
  }
}

/**
 * Check if a location has any Google Places photo URLs (not yet cached in Supabase)
 */
function locationHasGooglePhotos(location) {
  if (!location) return false;
  const isGoogleUrl = (url) => url && typeof url === 'string' && url.includes('maps.googleapis.com/maps/api/place/photo');
  
  if (isGoogleUrl(location.photo)) return true;
  if (Array.isArray(location.photos)) {
    return location.photos.some(p => isGoogleUrl(p));
  }
  return false;
}

/**
 * Migrate photos for a single location: download from Google, upload to Supabase
 * Extracts photo_reference from existing URLs to avoid needing another Places API call
 */
async function migrateLocationPhotos(location) {
  if (!location) return null;

  const photos = Array.isArray(location.photos) ? location.photos : (location.photo ? [location.photo] : []);
  if (photos.length === 0) return null;

  const isGoogleUrl = (url) => url && typeof url === 'string' && url.includes('maps.googleapis.com/maps/api/place/photo');

  const migratedPhotos = [];
  let downloaded = 0;
  let cached = 0;

  for (const photoUrl of photos.slice(0, 5)) { // Process up to 5 photos per location (fast)
    if (!isGoogleUrl(photoUrl)) {
      // Already a Supabase URL or other non-Google URL — keep it
      migratedPhotos.push(photoUrl);
      continue;
    }

    // Extract photoreference from the URL
    const refMatch = photoUrl.match(/photoreference=([^&]+)/);
    if (!refMatch) {
      migratedPhotos.push(photoUrl); // Can't extract reference, keep original
      continue;
    }

    const photoReference = refMatch[1];
    const placeId = location.place_id || 'unknown-place';

    try {
      const cachedUrl = await cachePhotoInSupabase(placeId, photoReference);
      if (cachedUrl) {
        migratedPhotos.push(cachedUrl);
        if (cachedUrl.includes('supabase')) {
          // Check if it was already cached or freshly downloaded
          // The cachePhotoInSupabase function logs this
          downloaded++; // Approximate — may include already-cached
        }
      } else {
        migratedPhotos.push(photoUrl); // Fallback to original
      }
    } catch (err) {
      console.warn(`  ⚠️ Failed to cache photo: ${err.message}`);
      migratedPhotos.push(photoUrl); // Keep original on error
    }
  }

  return {
    photos: migratedPhotos,
    downloaded,
    cached
  };
}

/**
 * Download a Google Place photo and cache it in Supabase Storage
 */
async function cachePhotoInSupabase(placeId, photoReference) {
  if (!supabase || !placeId || !photoReference) return null;

  const fileName = `place-photos/${placeId}/${photoReference.substring(0, 40)}.jpg`;
  const dirPath = `place-photos/${placeId}`;
  const fileBaseName = `${photoReference.substring(0, 40)}.jpg`;

  // Check if photo already exists in storage
  try {
    const { data: files } = await supabase.storage
      .from('tour-assets')
      .list(dirPath, { limit: 100 });

    if (files && files.some(f => f.name === fileBaseName)) {
      const { data: urlData } = supabase.storage
        .from('tour-assets')
        .getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        console.log(`  ♻️ Already cached: ${fileBaseName}`);
        return urlData.publicUrl;
      }
    }
  } catch (e) {
    // Storage might not have the directory yet
  }

  // Download photo from Google (this IS a billable API call — but only happens ONCE)
  const googlePhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${process.env.GOOGLE_MAPS_KEY}`;

  const photoResponse = await fetch(googlePhotoUrl, { redirect: 'follow' });
  if (!photoResponse.ok) {
    console.warn(`  ❌ Google download failed: ${photoResponse.status}`);
    return null;
  }

  const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
  const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('tour-assets')
    .upload(fileName, photoBuffer, {
      contentType,
      upsert: true
    });

  if (uploadError) {
    console.warn(`  ❌ Supabase upload failed: ${uploadError.message}`);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('tour-assets')
    .getPublicUrl(fileName);

  console.log(`  ✅ Downloaded & cached: ${fileBaseName}`);
  return urlData?.publicUrl || null;
}
