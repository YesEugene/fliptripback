// Mass migration: cache ALL Google Places photos to Supabase Storage
// Run once to eliminate ongoing Google Places Photo API costs

import { supabase } from '../database/db.js';

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

    const { tourId, limit: batchLimit } = req.body || {};
    const maxBlocks = batchLimit || 3;

    console.log(`🚀 Photo migration (tourId=${tourId || 'ALL'}, limit=${maxBlocks})`);

    // Fetch location blocks
    let query = supabase
      .from('tour_content_blocks')
      .select('id, tour_id, content, block_type')
      .eq('block_type', 'location')
      .limit(500);

    if (tourId) {
      query = query.eq('tour_id', tourId);
    }

    const { data: allBlocks, error: blocksError } = await query;

    if (blocksError) {
      return res.status(500).json({ error: 'Failed to fetch blocks', details: blocksError.message });
    }

    if (!allBlocks || allBlocks.length === 0) {
      return res.status(200).json({ success: true, message: 'No location blocks found', stats: { total: 0 } });
    }

    // Filter blocks that need migration: have Google URLs AND have not been attempted recently
    const isGoogleUrl = (url) => url && typeof url === 'string' && url.includes('maps.googleapis.com/maps/api/place/photo');
    
    const blocksNeedingMigration = allBlocks.filter(block => {
      const content = block.content || {};
      const checkLoc = (loc) => {
        if (!loc) return false;
        // Skip if already attempted migration (has _photosRefreshedAt)
        if (loc._photosRefreshedAt) return false;
        const photos = Array.isArray(loc.photos) ? loc.photos : (loc.photo ? [loc.photo] : []);
        return photos.some(p => isGoogleUrl(p));
      };
      return checkLoc(content.mainLocation) ||
             (content.alternativeLocations || []).some(alt => checkLoc(alt));
    });

    console.log(`📊 ${allBlocks.length} total, ${blocksNeedingMigration.length} need migration`);

    if (blocksNeedingMigration.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'All photos already migrated or attempted!', 
        stats: { total: allBlocks.length, needsMigration: 0, migrated: 0 } 
      });
    }

    const blocksToProcess = blocksNeedingMigration.slice(0, maxBlocks);
    let migratedCount = 0;
    let photosDownloaded = 0;
    let photosCachedExisting = 0;
    let photosFailed = 0;
    const errors = [];
    const details = [];

    for (const block of blocksToProcess) {
      const content = JSON.parse(JSON.stringify(block.content || {}));
      let changed = false;

      // Migrate main location
      if (content.mainLocation && !content.mainLocation._photosRefreshedAt) {
        const mainPhotos = Array.isArray(content.mainLocation.photos) ? content.mainLocation.photos : 
                          (content.mainLocation.photo ? [content.mainLocation.photo] : []);
        
        if (mainPhotos.some(p => isGoogleUrl(p))) {
          const result = await migratePhotosArray(mainPhotos, content.mainLocation.place_id || 'unknown');
          content.mainLocation.photos = result.photos;
          content.mainLocation.photo = result.photos[0] || content.mainLocation.photo;
          content.mainLocation._photosRefreshedAt = new Date().toISOString();
          changed = true;
          photosDownloaded += result.downloaded;
          photosCachedExisting += result.cached;
          photosFailed += result.failed;
          details.push({ loc: content.mainLocation.title || 'main', ...result.summary });
        }
      }

      // Migrate alternative locations
      if (content.alternativeLocations && Array.isArray(content.alternativeLocations)) {
        for (let i = 0; i < content.alternativeLocations.length; i++) {
          const alt = content.alternativeLocations[i];
          if (alt._photosRefreshedAt) continue;
          
          const altPhotos = Array.isArray(alt.photos) ? alt.photos : (alt.photo ? [alt.photo] : []);
          if (altPhotos.some(p => isGoogleUrl(p))) {
            const result = await migratePhotosArray(altPhotos, alt.place_id || 'unknown');
            content.alternativeLocations[i].photos = result.photos;
            content.alternativeLocations[i].photo = result.photos[0] || alt.photo;
            content.alternativeLocations[i]._photosRefreshedAt = new Date().toISOString();
            changed = true;
            photosDownloaded += result.downloaded;
            photosCachedExisting += result.cached;
            photosFailed += result.failed;
            details.push({ loc: alt.title || `alt-${i}`, ...result.summary });
          }
        }
      }

      if (changed) {
        const { error: updateError } = await supabase
          .from('tour_content_blocks')
          .update({ content })
          .eq('id', block.id);

        if (updateError) {
          errors.push({ block: block.id, error: updateError.message });
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
      photosCachedExisting,
      photosFailed,
      errorsCount: errors.length,
      remainingBlocks: blocksNeedingMigration.length - blocksToProcess.length
    };

    return res.status(200).json({
      success: true,
      message: stats.remainingBlocks > 0 
        ? `Migrated ${migratedCount} blocks. ${stats.remainingBlocks} remaining.`
        : `Migration complete! ${migratedCount} blocks migrated.`,
      stats,
      details: details.slice(0, 20),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return res.status(500).json({ error: 'Migration failed', message: error.message });
  }
}

/**
 * Migrate an array of photo URLs: download Google ones and cache in Supabase
 */
async function migratePhotosArray(photos, placeId) {
  const isGoogleUrl = (url) => url && typeof url === 'string' && url.includes('maps.googleapis.com/maps/api/place/photo');
  
  const result = { photos: [], downloaded: 0, cached: 0, failed: 0, summary: {} };
  
  for (const photoUrl of photos.slice(0, 5)) {
    if (!isGoogleUrl(photoUrl)) {
      result.photos.push(photoUrl);
      continue;
    }

    // Extract photoreference from URL
    const refMatch = photoUrl.match(/photoreference=([^&]+)/);
    if (!refMatch) {
      result.photos.push(photoUrl);
      result.failed++;
      continue;
    }

    const photoReference = refMatch[1];
    
    try {
      const cachedUrl = await cachePhotoInSupabase(placeId, photoReference);
      if (cachedUrl) {
        result.photos.push(cachedUrl);
        if (cachedUrl.includes('supabase')) {
          result.downloaded++;
        } else {
          result.cached++;
        }
      } else {
        result.photos.push(photoUrl); // Keep original
        result.failed++;
      }
    } catch (err) {
      console.warn(`  ⚠️ Cache failed: ${err.message}`);
      result.photos.push(photoUrl);
      result.failed++;
    }
  }

  const supabaseCount = result.photos.filter(u => u && u.includes('supabase')).length;
  const googleCount = result.photos.filter(u => isGoogleUrl(u)).length;
  result.summary = { total: result.photos.length, supabase: supabaseCount, google: googleCount, downloaded: result.downloaded, failed: result.failed };
  
  return result;
}

/**
 * Download a Google Place photo and cache it in Supabase Storage
 */
async function cachePhotoInSupabase(placeId, photoReference) {
  if (!supabase || !placeId || !photoReference) {
    console.warn('  ⚠️ cachePhoto: missing params', { hasSupabase: !!supabase, placeId, refLen: photoReference?.length });
    return null;
  }

  const safeRef = photoReference.substring(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `place-photos/${placeId}/${safeRef}.jpg`;
  const dirPath = `place-photos/${placeId}`;

  // Check if already cached
  try {
    const { data: files, error: listError } = await supabase.storage
      .from('tour-assets')
      .list(dirPath, { limit: 100 });

    if (listError) {
      console.warn(`  ⚠️ Storage list error: ${listError.message}`);
      // Bucket might not exist — try to continue anyway
    } else if (files && files.some(f => f.name === `${safeRef}.jpg`)) {
      const { data: urlData } = supabase.storage
        .from('tour-assets')
        .getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        console.log(`  ♻️ Already cached: ${safeRef}`);
        return urlData.publicUrl;
      }
    }
  } catch (e) {
    console.warn(`  ⚠️ Storage check error: ${e.message}`);
  }

  // Download from Google (ONE-TIME billable call)
  const googlePhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoReference}&key=${process.env.GOOGLE_MAPS_KEY}`;

  let photoResponse;
  try {
    photoResponse = await fetch(googlePhotoUrl, { redirect: 'follow' });
  } catch (fetchErr) {
    console.warn(`  ❌ Google fetch error: ${fetchErr.message}`);
    return null;
  }
  
  if (!photoResponse.ok) {
    console.warn(`  ❌ Google photo ${photoResponse.status}: ref=${safeRef}`);
    return null;
  }

  let photoBuffer;
  try {
    photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
  } catch (bufErr) {
    console.warn(`  ❌ Buffer error: ${bufErr.message}`);
    return null;
  }
  
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

  console.log(`  ✅ Cached: ${safeRef}`);
  return urlData?.publicUrl || null;
}
