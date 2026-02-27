import { supabase } from '../database/db.js';

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function extractLocationCandidates(content) {
  if (!content || typeof content !== 'object') return [];
  const list = [];
  const pushIfValid = (loc) => {
    if (!loc || typeof loc !== 'object') return;
    const name = (loc.title || loc.name || '').toString().trim();
    if (!name) return;
    list.push(loc);
  };
  pushIfValid(content.mainLocation || content);
  if (Array.isArray(content.alternativeLocations)) {
    content.alternativeLocations.forEach(pushIfValid);
  }
  return list;
}

function extractInterestIds(location) {
  const interests = Array.isArray(location?.interests) ? location.interests : [];
  return interests
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return item;
      if (item && item.id !== undefined && item.id !== null) return item.id;
      if (item && item.interest_id !== undefined && item.interest_id !== null) return item.interest_id;
      return null;
    })
    .filter((id) => id !== null && id !== undefined && id !== '');
}

async function getUserFromToken(authHeader) {
  if (!authHeader) return { userId: null, isAdmin: false };

  let userId = null;
  const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
    userId = payload.userId || payload.id || payload.sub;
  } catch (e) {
    const { data: { user }, error } = await supabase.auth.getUser(cleanToken);
    if (!error && user) userId = user.id;
  }

  if (!userId) return { userId: null, isAdmin: false };

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return { userId, isAdmin: userData?.role === 'admin' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { userId, isAdmin } = await getUserFromToken(req.headers.authorization);
    if (!userId || !isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { tourId, limit = 500, pruneUnused = false } = req.body || {};

    let query = supabase
      .from('tour_content_blocks')
      .select('id, tour_id, content')
      .eq('block_type', 'location')
      .limit(Number(limit) || 500);

    if (tourId) query = query.eq('tour_id', tourId);

    const { data: blocks, error: blocksError } = await query;
    if (blocksError) {
      return res.status(500).json({ success: false, error: blocksError.message });
    }

    if (!blocks || blocks.length === 0) {
      return res.status(200).json({ success: true, stats: { processedBlocks: 0, created: 0, updated: 0, skipped: 0 } });
    }

    const tourIds = [...new Set(blocks.map((b) => b.tour_id).filter(Boolean))];
    const { data: tours } = await supabase
      .from('tours')
      .select('id, city_id, source')
      .in('id', tourIds);
    const tourMetaById = new Map((tours || []).map((t) => [t.id, {
      city_id: t.city_id || null,
      source: t.source || null
    }]));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const block of blocks) {
      const tourMeta = tourMetaById.get(block.tour_id) || { city_id: null, source: null };
      const fallbackCityId = tourMeta.city_id || null;
      const locationSource = String(tourMeta.source || '').toLowerCase() === 'user_generated'
        ? 'ai'
        : 'guide';
      const candidates = extractLocationCandidates(block.content);

      for (const loc of candidates) {
        const name = (loc.title || loc.name || '').toString().trim();
        if (!name) {
          skipped++;
          continue;
        }

        const address = (loc.address || '').toString().trim() || null;
        const cityId = loc.city_id || fallbackCityId || null;
        const googlePlaceId = (loc.place_id || loc.google_place_id || '').toString().trim() || null;
        const description = (loc.description || '').toString().trim() || null;
        const recommendations = (loc.recommendations || '').toString().trim() || null;
        const rawPriceLevel = loc.price_level ?? loc.priceLevel ?? null;
        const parsedPriceLevel = rawPriceLevel !== null && rawPriceLevel !== undefined && rawPriceLevel !== ''
          ? parseInt(rawPriceLevel, 10)
          : 2;
        const priceLevel = Number.isNaN(parsedPriceLevel) ? 2 : parsedPriceLevel;

        let existingLocation = null;

        if (googlePlaceId) {
          const { data } = await supabase
            .from('locations')
            .select('id')
            .eq('google_place_id', googlePlaceId)
            .maybeSingle();
          existingLocation = data || null;
        }

        if (!existingLocation) {
          let locationQuery = supabase
            .from('locations')
            .select('id')
            .eq('name', name);

          if (cityId) locationQuery = locationQuery.eq('city_id', cityId);
          else locationQuery = locationQuery.is('city_id', null);
          if (address) locationQuery = locationQuery.eq('address', address);

          const { data } = await locationQuery.maybeSingle();
          existingLocation = data || null;
        }

        const payload = {
          name,
          city_id: cityId,
          address,
          description,
          recommendations,
          source: locationSource,
          google_place_id: googlePlaceId,
          price_level: priceLevel
        };

        if (existingLocation?.id) {
          const updatePayload = { ...payload };
          if (isValidUuid(userId)) updatePayload.updated_by = userId;
          await supabase.from('locations').update(updatePayload).eq('id', existingLocation.id);
          updated++;

          const interestIds = extractInterestIds(loc);
          if (interestIds.length > 0) {
            await supabase.from('location_interests').delete().eq('location_id', existingLocation.id);
            await supabase.from('location_interests').insert(
              interestIds.map((interestId) => ({ location_id: existingLocation.id, interest_id: interestId }))
            );
          }
        } else {
          const insertPayload = { ...payload };
          if (isValidUuid(userId)) {
            insertPayload.created_by = userId;
            insertPayload.updated_by = userId;
          }
          const { data: inserted } = await supabase
            .from('locations')
            .insert(insertPayload)
            .select('id')
            .single();

          if (inserted?.id) {
            created++;
            const interestIds = extractInterestIds(loc);
            if (interestIds.length > 0) {
              await supabase.from('location_interests').insert(
                interestIds.map((interestId) => ({ location_id: inserted.id, interest_id: interestId }))
              );
            }
          } else {
            skipped++;
          }
        }
      }
    }

    let deleted = 0;

    if (pruneUnused) {
      const usedLocationIds = new Set();
      const usedContentKeys = new Set();

      const [{ data: linkedTourItems }, { data: allLocationBlocks }, { data: allLocations }] = await Promise.all([
        supabase.from('tour_items').select('location_id').not('location_id', 'is', null),
        supabase.from('tour_content_blocks').select('content').eq('block_type', 'location').limit(10000),
        supabase.from('locations').select('id, name, address')
      ]);

      (linkedTourItems || []).forEach(item => {
        if (item.location_id) usedLocationIds.add(item.location_id);
      });

      const normalize = (value) => (value || '').toString().trim().toLowerCase();
      const addKey = (loc) => {
        if (!loc || typeof loc !== 'object') return;
        const name = normalize(loc.title || loc.name);
        if (!name) return;
        const address = normalize(loc.address);
        usedContentKeys.add(`${name}|${address}`);
        usedContentKeys.add(`${name}|`);
      };

      (allLocationBlocks || []).forEach(block => {
        const content = block?.content || {};
        addKey(content.mainLocation || content);
        if (Array.isArray(content.alternativeLocations)) {
          content.alternativeLocations.forEach(addKey);
        }
      });

      const toDeleteIds = (allLocations || [])
        .filter((loc) => {
          if (usedLocationIds.has(loc.id)) return false;
          const name = normalize(loc.name);
          const address = normalize(loc.address);
          return !(usedContentKeys.has(`${name}|${address}`) || usedContentKeys.has(`${name}|`));
        })
        .map((loc) => loc.id);

      if (toDeleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('locations')
          .delete()
          .in('id', toDeleteIds);

        if (!deleteError) {
          deleted = toDeleteIds.length;
        }
      }
    }

    return res.status(200).json({
      success: true,
      stats: {
        processedBlocks: blocks.length,
        created,
        updated,
        skipped,
        deleted
      }
    });
  } catch (error) {
    console.error('❌ sync-locations-from-content-blocks error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

