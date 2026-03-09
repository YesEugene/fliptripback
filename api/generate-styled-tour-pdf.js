import PDFDocument from 'pdfkit';
import { supabase } from '../database/db.js';

function sanitizeFileName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);
}

async function getUserFromToken(authHeader) {
  if (!authHeader) return { userId: null, isAdmin: false };
  const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  let userId = null;
  try {
    const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString());
    userId = payload.userId || payload.id || payload.sub;
  } catch (_) {
    const { data: { user }, error } = await supabase.auth.getUser(cleanToken);
    if (!error && user) userId = user.id;
  }

  if (!userId) return { userId: null, isAdmin: false };

  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  return { userId, isAdmin: userData?.role === 'admin' };
}

async function canEditTour(tourId, userId, isAdmin) {
  if (isAdmin) return true;
  if (!tourId || !userId) return false;

  const { data: tour } = await supabase
    .from('tours')
    .select('*')
    .eq('id', tourId)
    .maybeSingle();

  if (!tour) return false;
  const ownerId = tour.guide_id || tour.creator_id || tour.user_id || tour.created_by;
  return String(ownerId || '') === String(userId || '');
}

async function ensureBucketAllowsPdf() {
  try {
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket('tour-assets');
    if (bucketError || !bucket) return;

    const currentMime = Array.isArray(bucket.allowed_mime_types) ? bucket.allowed_mime_types : null;
    const currentLimit = Number(bucket.file_size_limit || 0);
    const requiredLimit = 50 * 1024 * 1024;
    const needsMimeUpdate = Array.isArray(currentMime) && !currentMime.includes('application/pdf');
    const needsSizeUpdate = currentLimit > 0 && currentLimit < requiredLimit;
    if (!needsMimeUpdate && !needsSizeUpdate) return;

    const nextMime = currentMime ? [...new Set([...currentMime, 'application/pdf'])] : null;
    await supabase.storage.updateBucket('tour-assets', {
      public: bucket.public ?? true,
      fileSizeLimit: Math.max(currentLimit || 0, requiredLimit),
      allowedMimeTypes: nextMime || undefined
    });
  } catch (error) {
    console.warn('⚠️ Could not ensure PDF mime in tour-assets bucket:', error?.message || error);
  }
}

function parseNumericCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractLatLngFromLocation(loc = {}) {
  if (!loc || typeof loc !== 'object') return { lat: null, lng: null };

  let lat = parseNumericCoordinate(loc.lat ?? loc.latitude);
  let lng = parseNumericCoordinate(loc.lng ?? loc.longitude ?? loc.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = parseNumericCoordinate(loc?.location?.lat ?? loc?.location?.latitude ?? loc?.position?.lat);
    lng = parseNumericCoordinate(loc?.location?.lng ?? loc?.location?.longitude ?? loc?.position?.lng ?? loc?.position?.lon);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = parseNumericCoordinate(loc?.coordinates?.lat ?? loc?.coordinates?.latitude);
    lng = parseNumericCoordinate(loc?.coordinates?.lng ?? loc?.coordinates?.longitude ?? loc?.coordinates?.lon);
  }

  // Support array coordinates: [lng, lat] (GeoJSON) or [lat, lng]
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) {
    const c0 = parseNumericCoordinate(loc.coordinates[0]);
    const c1 = parseNumericCoordinate(loc.coordinates[1]);
    if (Number.isFinite(c0) && Number.isFinite(c1)) {
      if (Math.abs(c0) <= 90 && Math.abs(c1) <= 180) {
        lat = c0;
        lng = c1;
      } else {
        lng = c0;
        lat = c1;
      }
    }
  }

  // Google LatLng literal-like payloads
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && loc?.geometry?.location) {
    lat = parseNumericCoordinate(loc.geometry.location.lat);
    lng = parseNumericCoordinate(loc.geometry.location.lng);
  }

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

function extractLocationsFromBlocks(blocks = []) {
  const all = [];
  const pushLoc = (loc) => {
    if (!loc || typeof loc !== 'object') return;
    const name = String(loc.title || loc.name || '').trim();
    const address = String(loc.address || '').trim();
    const { lat, lng } = extractLatLngFromLocation(loc);
    if (!name && !address) return;
    all.push({
      name: name || address || 'Location',
      address,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null
    });
  };

  blocks.forEach((block) => {
    // Use map block locations as canonical source when available:
    // these points are already synchronized in the visualizer.
    if (block.block_type === 'map') {
      const mapLocations = Array.isArray(block?.content?.locations) ? block.content.locations : [];
      mapLocations.forEach(pushLoc);
      return;
    }

    if (block.block_type !== 'location') return;
    const content = block.content || {};
    pushLoc(content.mainLocation || content);
    if (Array.isArray(content.alternativeLocations)) {
      content.alternativeLocations.forEach(pushLoc);
    }
  });

  // De-duplicate by name+address
  const map = new Map();
  all.forEach((loc) => {
    const key = `${loc.name}::${loc.address}`.toLowerCase();
    if (!map.has(key)) map.set(key, loc);
  });
  return Array.from(map.values());
}

async function geocodeLocationWithMapbox(location, token) {
  const query = location?.address || location?.name;
  if (!query) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&language=en&access_token=${token}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const first = data?.features?.[0];
    if (!first?.center || first.center.length < 2) return null;
    return {
      ...location,
      lng: Number(first.center[0]),
      lat: Number(first.center[1])
    };
  } catch {
    return null;
  }
}

async function geocodeLocationWithGoogle(location, googleKey) {
  const query = location?.address || location?.name;
  if (!query || !googleKey) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    const geo = first?.geometry?.location;
    const lat = parseNumericCoordinate(geo?.lat);
    const lng = parseNumericCoordinate(geo?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      ...location,
      lat,
      lng
    };
  } catch {
    return null;
  }
}

function getMapboxToken() {
  return (
    process.env.MAPBOX_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_PUBLIC_TOKEN ||
    process.env.MAPBOX_SECRET_TOKEN ||
    process.env.VITE_MAPBOX_TOKEN ||
    ''
  );
}

function fallbackCityCenter(input = '') {
  const text = String(input || '').toLowerCase();
  const presets = [
    { keys: ['paris'], center: { lng: 2.3522, lat: 48.8566, zoom: 11 } },
    { keys: ['rome', 'roma'], center: { lng: 12.4964, lat: 41.9028, zoom: 11 } },
    { keys: ['barcelona'], center: { lng: 2.1734, lat: 41.3851, zoom: 11 } },
    { keys: ['london'], center: { lng: -0.1276, lat: 51.5072, zoom: 11 } },
    { keys: ['madrid'], center: { lng: -3.7038, lat: 40.4168, zoom: 11 } },
    { keys: ['lisbon', 'lisboa'], center: { lng: -9.1393, lat: 38.7223, zoom: 11 } },
    { keys: ['berlin'], center: { lng: 13.405, lat: 52.52, zoom: 11 } }
  ];
  for (const preset of presets) {
    if (preset.keys.some((k) => text.includes(k))) return preset.center;
  }
  return null;
}

function normalizeMapboxStyle(style = '') {
  const raw = String(style || '').trim();
  if (!raw) return '';
  if (raw.startsWith('mapbox://styles/')) {
    return raw.replace('mapbox://styles/', '');
  }
  return raw.replace(/^\/+/, '');
}

async function buildMapboxStaticUrl(locations = [], template = 'classic', options = {}) {
  const token = getMapboxToken();
  if (!token) return null;

  const styleByTemplate = {
    classic: normalizeMapboxStyle(process.env.MAPBOX_STYLE_CLASSIC) || 'mapbox/light-v11',
    magazine: normalizeMapboxStyle(process.env.MAPBOX_STYLE_MAGAZINE) || 'mapbox/streets-v12',
    minimal: normalizeMapboxStyle(process.env.MAPBOX_STYLE_MINIMAL) || 'mapbox/light-v11'
  };
  const style = styleByTemplate[template] || styleByTemplate.classic;
  const pinColor = String(process.env.MAPBOX_PIN_COLOR || 'e74c3c').replace('#', '');
  const googleMapsKey = String(process.env.GOOGLE_MAPS_KEY || '').trim();

  const withCoords = locations.filter((loc) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng));
  const withoutCoords = locations.filter((loc) => !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng));
  let resolved = [...withCoords];

  if (resolved.length < 3 && withoutCoords.length > 0) {
    const geocodeCandidates = withoutCoords.slice(0, 20);
    for (const candidate of geocodeCandidates) {
      let geocoded = await geocodeLocationWithMapbox(candidate, token);
      if (!geocoded && googleMapsKey) {
        geocoded = await geocodeLocationWithGoogle(candidate, googleMapsKey);
      }
      if (geocoded && Number.isFinite(geocoded.lat) && Number.isFinite(geocoded.lng)) {
        resolved.push(geocoded);
      }
    }
  }

  const finalCoords = resolved.slice(0, 20);
  if (finalCoords.length === 0) {
    const cityQuery = String(options?.cityName || '').trim();

    if (cityQuery) {
      const cityGeocoded = await geocodeLocationWithMapbox({ name: cityQuery }, token);
      if (cityGeocoded && Number.isFinite(cityGeocoded.lat) && Number.isFinite(cityGeocoded.lng)) {
        return `https://api.mapbox.com/styles/v1/${style}/static/pin-l+${pinColor}(${cityGeocoded.lng},${cityGeocoded.lat})/${cityGeocoded.lng},${cityGeocoded.lat},11/1200x620?access_token=${token}`;
      }
    }

    // Hard fallback if geocoding fails/unavailable: use known city presets by text signals.
    const citySignal = [
      cityQuery,
      ...locations.map((l) => `${l?.name || ''} ${l?.address || ''}`),
      String(options?.tourTitle || ''),
      String(options?.tourDescription || '')
    ].join(' ');
    const preset = fallbackCityCenter(citySignal);
    if (!preset) return null;
    return `https://api.mapbox.com/styles/v1/${style}/static/pin-l+${pinColor}(${preset.lng},${preset.lat})/${preset.lng},${preset.lat},${preset.zoom}/1200x620?access_token=${token}`;
  }

  const pins = finalCoords
    .map((loc) => `pin-s+${pinColor}(${loc.lng},${loc.lat})`)
    .join(',');

  let routeOverlay = '';
  if (finalCoords.length >= 2) {
    const routeFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: finalCoords.map((loc) => [loc.lng, loc.lat])
      },
      properties: {
        'stroke': '#1D4ED8',
        'stroke-width': 3.5,
        'stroke-opacity': 0.85
      }
    };
    routeOverlay = `geojson(${encodeURIComponent(JSON.stringify(routeFeature))}),`;
  }

  return `https://api.mapbox.com/styles/v1/${style}/static/${routeOverlay}${pins}/auto/1200x620?padding=70,70,70,70&access_token=${token}`;
}

function templateConfig(template = 'classic') {
  if (template === 'magazine') {
    return { accent: '#1D4ED8', muted: '#4B5563' };
  }
  if (template === 'minimal') {
    return { accent: '#111827', muted: '#6B7280' };
  }
  return { accent: '#2563EB', muted: '#4B5563' };
}

function htmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePhotoList(value) {
  const arr = Array.isArray(value) ? value : (value ? [value] : []);
  return arr
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const candidate = item.url || item.src || item.image || item.photo || '';
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter((item) => item && (item.startsWith('http://') || item.startsWith('https://') || item.startsWith('data:image/')));
}

function cleanRichText(raw = '') {
  const source = String(raw || '');
  if (!source) return '';
  return source
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(div|p|li|h1|h2|h3|h4|h5|h6)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphsFromRichText(raw = '') {
  const cleaned = cleanRichText(raw);
  if (!cleaned) return [];
  return cleaned
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractContentSectionsForHtml(blocks = []) {
  const sections = [];

  (blocks || []).forEach((block) => {
    const type = block?.block_type;
    const content = block?.content || {};

    if (type === 'heading' || type === 'title') {
      const title = cleanRichText(content.text || content.title || '');
      if (title) {
        sections.push({ type: 'heading', title, paragraphs: [], photos: [] });
      }
      return;
    }

    if (type === 'text') {
      const paragraphs = paragraphsFromRichText(content.text || '');
      if (!paragraphs.length) return;
      const combined = paragraphs.join('\n\n');
      sections.push({
        type: 'text',
        title: null,
        paragraphs,
        useColumns: combined.length > 1200,
        photos: []
      });
      return;
    }

    if (type === 'photo_text' || type === 'fullwidth_image') {
      const title = cleanRichText(content.title || '');
      const paragraphs = paragraphsFromRichText(content.text || content.caption || '');
      const combined = paragraphs.join('\n\n');
      const alignment = String(content.alignment || 'left').toLowerCase() === 'right' ? 'right' : 'left';
      sections.push({
        type: 'photo_text',
        title: title || null,
        paragraphs,
        photos: normalizePhotoList(content.photos || content.photo).slice(0, 4),
        useColumns: combined.length > 950,
        alignment
      });
      return;
    }

    if (type === 'location') {
      const main = content.mainLocation || content;
      const title = cleanRichText(main?.title || main?.name || '');
      const address = cleanRichText(main?.address || '');
      const description = cleanRichText(main?.description || '');
      const recommendations = cleanRichText(main?.recommendations || '');
      const rating = String(main?.rating ?? '').trim();
      const price = cleanRichText(main?.priceLevel || main?.price_level || main?.price || '');
      const paragraphs = [description].filter(Boolean);
      const photos = normalizePhotoList(main?.photos || main?.photo).slice(0, 6);
      const alternatives = Array.isArray(content.alternativeLocations)
        ? content.alternativeLocations
            .filter((alt) => alt && typeof alt === 'object')
            .map((alt) => ({
              title: cleanRichText(alt.title || alt.name || ''),
              address: cleanRichText(alt.address || ''),
              description: cleanRichText(alt.description || ''),
              rating: String(alt.rating ?? '').trim(),
              price: cleanRichText(alt.priceLevel || alt.price_level || alt.price || ''),
              photos: normalizePhotoList(alt.photos || alt.photo).slice(0, 1)
            }))
            .filter((alt) => alt.title || alt.description || alt.address)
        : [];
      if (title || paragraphs.length > 0 || recommendations || photos.length > 0) {
        sections.push({
          type: 'location',
          title: title || null,
          address,
          paragraphs,
          photos,
          useColumns: description.length > 1050,
          recommendations,
          rating,
          price,
          alternatives
        });
      }
      return;
    }

    if (type === '3columns') {
      const columns = Array.isArray(content.columns) ? content.columns : [];
      const items = columns
        .map((col) => {
          if (!col || typeof col !== 'object') return null;
          return {
            photo: normalizePhotoList(col.photo || col.photos || col.image)[0] || '',
            text: cleanRichText(col.text || '')
          };
        })
        .filter(Boolean)
        .filter((item) => item.photo || item.text);
      if (items.length > 0) {
        sections.push({
          type: 'three_columns',
          items
        });
      }
      return;
    }

    if (type === 'photo') {
      const photos = normalizePhotoList(content.photos || content.photo);
      const caption = cleanRichText(content.caption || '');
      if (photos.length > 0 || caption) {
        sections.push({
          type: 'photo',
          photos,
          caption
        });
      }
      return;
    }
  });

  return sections;
}

function buildStyledPdfHtml({ tour, blocks, template = 'classic', layout = {}, mapUrl = null, locations = [] }) {
  const cfg = templateConfig(template);
  const draft = (tour?.draft_data && typeof tour.draft_data === 'object') ? tour.draft_data : {};
  const title = cleanRichText(draft.title || tour?.title || 'FlipTrip Guide');
  const subtitle = cleanRichText(layout?.subtitle || draft.shortDescription || tour?.description || '');
  const aboutTripParagraphs = paragraphsFromRichText(draft.description || tour?.description || '');
  const previewImage = String(draft.previewOriginal || draft.preview || tour?.preview_media_url || '').trim();
  const sections = extractContentSectionsForHtml(blocks);
  const logoUrl = 'https://raw.githubusercontent.com/YesEugene/fliptripfront/main/src/assets/FlipTripLogo.svg';

  const mapHtml = !mapUrl ? '' : `
    <section class="ft-section ft-section-block">
      <h2 class="ft-headline">Route map</h2>
      <img class="ft-map" src="${htmlEscape(mapUrl)}" alt="Tour route map"/>
    </section>
  `;

  const locationsHtml = locations.length === 0 ? '' : `
    <section class="ft-section ft-section-block">
      <h2 class="ft-headline">Locations</h2>
      <ol class="ft-locations">
        ${locations.map((loc) => `
          <li>
            <span class="name">${htmlEscape(loc.name || '')}</span>
            ${loc.address ? `<span class="address">${htmlEscape(loc.address)}</span>` : ''}
          </li>
        `).join('')}
      </ol>
    </section>
  `;

  const sectionsHtml = sections.map((section) => {
    if (section.type === 'heading') {
      return `<section class="ft-section ft-section-block ft-heading-block" data-keep-with-next="true"><h2 class="ft-headline">${htmlEscape(section.title || '')}</h2></section>`;
    }

    const titleHtml = section.title ? `<h3>${htmlEscape(section.title)}</h3>` : '';
    const addressHtml = section.address ? `<div class="ft-address">${htmlEscape(section.address)}</div>` : '';
    const paragraphs = section.paragraphs?.length
      ? section.paragraphs.map((p) => `<p>${htmlEscape(p)}</p>`).join('')
      : '';
    const isPhotoText = section.type === 'photo_text';
    const isThreeColumns = section.type === 'three_columns';
    const isPhotoBlock = section.type === 'photo';
    const textWrapClass = section.useColumns && !isPhotoText ? 'ft-text columns' : 'ft-text';
    const isLocation = section.type === 'location';

    if (isThreeColumns) {
      return `
        <section class="ft-section ft-section-block">
          <div class="ft-three-columns-grid">
            ${(section.items || []).map((item) => `
              <div class="ft-three-col-item">
                ${item.photo ? `<img class="ft-three-col-photo" src="${htmlEscape(item.photo)}" alt="Three column image"/>` : ''}
                ${item.text ? `<p class="ft-three-col-text">${htmlEscape(item.text)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }

    if (isPhotoBlock) {
      const mainPhoto = section.photos?.[0] || '';
      const extraPhotos = (section.photos || []).slice(1, 4);
      return `
        <section class="ft-section ft-section-block">
          ${mainPhoto ? `<img class="ft-photo-block-main" src="${htmlEscape(mainPhoto)}" alt="Photo block"/>` : ''}
          ${extraPhotos.length > 0 ? `
            <div class="ft-photo-block-row">
              ${extraPhotos.map((src) => `<img class="ft-photo-block-thumb" src="${htmlEscape(src)}" alt="Photo block extra"/>`).join('')}
            </div>
          ` : ''}
          ${section.caption ? `<p class="ft-photo-block-caption">${htmlEscape(section.caption)}</p>` : ''}
        </section>
      `;
    }
    const locationMetaHtml = '';
    const recommendationsHtml = isLocation && section.recommendations ? `
      <div class="ft-recommend-box">
        <div class="ft-recommend-title">Author also recommends</div>
        <p>${htmlEscape(section.recommendations)}</p>
      </div>
    ` : '';
    const alternativesHtml = isLocation && Array.isArray(section.alternatives) && section.alternatives.length > 0 ? `
      <div class="ft-alt-locations-block">
        <div class="ft-alt-locations-title">Author also recommends</div>
        <div class="ft-alt-locations-grid">
          ${section.alternatives.map((alt) => `
            <article class="ft-alt-location-card">
              <h4>${htmlEscape(alt.title || '')}</h4>
              ${alt.address ? `<div class="ft-alt-location-address">📍 ${htmlEscape(alt.address)}</div>` : ''}
              ${(alt.rating || alt.price) ? `<div class="ft-alt-location-meta">${alt.rating ? `⭐ ${htmlEscape(alt.rating)}` : ''}${alt.rating && alt.price ? '   ' : ''}${alt.price ? `💰 ${htmlEscape(alt.price)}` : ''}</div>` : ''}
              ${alt.description ? `<p>${htmlEscape(alt.description)}</p>` : ''}
            </article>
          `).join('')}
        </div>
      </div>
    ` : '';
    const photoGrid = !section.photos?.length ? '' : (isLocation ? `
      <div class="ft-location-photos">
        <div class="ft-location-photo-layout ft-adaptive-grid">
          <img class="ft-main-photo" src="${htmlEscape(section.photos[0])}" alt="${htmlEscape(section.title || 'Location photo')}"/>
          ${section.photos.length > 1 ? `
            <div class="ft-thumb-stack">
              ${section.photos.slice(1, 5).map((src, i) => `<img class="ft-thumb-photo" src="${htmlEscape(src)}" alt="${htmlEscape(section.title || `Location photo ${i + 2}`)}"/>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    ` : `
      <div class="ft-photo-grid ft-adaptive-grid ${section.photos.length > 1 ? 'has-many' : ''}">
        ${section.photos.map((src, i) => `<img class="${i === 0 ? 'ft-main-photo' : 'ft-thumb-photo'}" src="${htmlEscape(src)}" alt="${htmlEscape(section.title || `Tour image ${i + 1}`)}"/>`).join('')}
      </div>
    `);

    if (isPhotoText) {
      const sideImage = section.photos?.[0] || '';
      const imageHtml = sideImage
        ? `<div class="ft-photo-text-image-wrap"><img class="ft-photo-text-image" src="${htmlEscape(sideImage)}" alt="${htmlEscape(section.title || 'Photo block image')}"/></div>`
        : '';
      return `
        <section class="ft-section ft-section-block ft-photo-text-block ${section.alignment === 'right' ? 'photo-on-right' : 'photo-on-left'}">
          ${titleHtml}
          <div class="ft-photo-text-layout">
            ${imageHtml}
            <div class="${textWrapClass}">
              ${paragraphs}
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="ft-section ft-section-block ${isLocation ? 'ft-location-section' : ''}">
        ${photoGrid}
        ${titleHtml}
        ${addressHtml}
        ${locationMetaHtml}
        <div class="${textWrapClass}">
          ${paragraphs}
        </div>
        ${recommendationsHtml}
        ${alternativesHtml}
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #111827;
        background: #FCFBF9;
        padding: 24px 0 48px;
      }
      .ft-book {
        width: 900px;
        margin: 0 auto;
      }
      .ft-page {
        width: 900px;
        min-height: 1273px;
        margin: 0 auto 28px;
        background: #FCFBF9;
        border: 1px solid #e8e1d7;
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12);
        page-break-after: always;
      }
      .ft-page:last-child {
        page-break-after: auto;
      }
      .ft-page-inner {
        width: 100%;
        padding: 28px 58px 50px;
      }
      .ft-cover .ft-page-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding-top: 30px;
      }
      .ft-logo-mark {
        width: 92px;
        height: auto;
        display: block;
        margin-bottom: 14px;
      }
      h1 {
        margin: 0;
        font-size: 51px;
        line-height: 1.04;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.01em;
        max-width: 760px;
      }
      .ft-subtitle {
        margin-top: 18px;
        color: ${cfg.muted};
        font-size: 19px;
        line-height: 1.4;
        max-width: 640px;
      }
      .ft-hero {
        width: 100%;
        max-width: 760px;
        height: auto;
        display: block;
        margin-top: 26px;
      }
      .ft-cover-about {
        margin-top: 20px;
        max-width: 760px;
        text-align: left;
      }
      .ft-cover-about p {
        margin: 0 0 12px;
        font-size: 15px;
        line-height: 1.5;
      }
      .ft-section {
        margin-top: 24px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .ft-heading-block {
        margin-top: 30px;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 42px;
        line-height: 1.2;
      }
      .ft-heading-block h2 {
        font-size: 30px;
      }
      .ft-headline {
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 34px;
        line-height: 1.08;
        text-transform: uppercase;
        letter-spacing: 0.01em;
        font-weight: 700;
      }
      .ft-location-section h3 {
        font-size: 30px;
      }
      .ft-address {
        color: #3E85FC;
        font-size: 14px;
        margin-bottom: 15px;
        font-weight: 500;
      }
      .ft-location-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 12px;
        font-size: 13px;
        color: #4b5563;
        font-weight: 600;
      }
      .ft-text p {
        margin: 0 0 11px;
        font-size: 14px;
        line-height: 1.55;
        orphans: 3;
        widows: 3;
      }
      .ft-text.columns {
        column-count: 2;
        column-gap: 24px;
      }
      .ft-locations {
        margin: 0;
        padding-left: 22px;
      }
      .ft-locations li {
        margin-bottom: 6px;
      }
      .ft-locations .name {
        display: block;
        font-size: 15px;
        font-weight: 600;
      }
      .ft-locations .address {
        display: block;
        color: ${cfg.muted};
        font-size: 12px;
      }
      .ft-map {
        width: 100%;
        max-height: 340px;
        object-fit: contain;
        display: block;
        background: #f3f4f6;
      }
      .ft-photo-grid,
      .ft-location-photo-layout {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 12px;
        align-items: start;
      }
      .ft-photo-grid img,
      .ft-location-photo-layout img {
        width: 100%;
        height: auto;
        object-fit: contain;
        display: block;
        background: #f3f4f6;
      }
      .ft-location-photos {
        margin: 12px 0;
      }
      .ft-adaptive-grid .ft-main-photo {
        grid-column: span 2;
      }
      .ft-adaptive-grid .ft-thumb-stack {
        grid-column: span 2;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .ft-adaptive-grid.is-landscape .ft-main-photo {
        grid-column: 1 / -1;
      }
      .ft-adaptive-grid.is-landscape .ft-thumb-stack {
        grid-column: 1 / -1;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .ft-recommend-box {
        margin-top: 10px;
        padding: 14px 16px;
        border: 1px solid #d9e1d0;
        background: #f3f7ef;
      }
      .ft-recommend-title {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .ft-recommend-box p {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
      }
      .ft-photo-text-block {
        margin-top: 24px;
      }
      .ft-photo-text-layout {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        align-items: start;
      }
      .ft-photo-text-image-wrap {
        grid-column: span 2;
      }
      .ft-photo-text-image {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        display: block;
        background: #f3f4f6;
      }
      .ft-photo-text-layout .ft-text {
        grid-column: span 2;
      }
      .ft-photo-text-block.photo-on-right .ft-photo-text-image-wrap {
        order: 2;
      }
      .ft-photo-text-block.photo-on-right .ft-photo-text-layout .ft-text {
        order: 1;
      }
      .ft-photo-text-block.photo-on-left .ft-photo-text-image-wrap {
        order: 1;
      }
      .ft-photo-text-block.photo-on-left .ft-photo-text-layout .ft-text {
        order: 2;
      }
      .ft-three-columns-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      .ft-three-col-photo {
        width: 100%;
        aspect-ratio: 1.55 / 1;
        object-fit: cover;
        display: block;
        background: #f3f4f6;
        margin-bottom: 8px;
      }
      .ft-three-col-text {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
      }
      .ft-photo-block-main {
        width: 100%;
        max-height: 420px;
        object-fit: cover;
        display: block;
        background: #f3f4f6;
      }
      .ft-photo-block-row {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .ft-photo-block-thumb {
        width: 100%;
        aspect-ratio: 1.6 / 1;
        object-fit: cover;
        display: block;
        background: #f3f4f6;
      }
      .ft-photo-block-caption {
        margin: 10px 0 0;
        font-size: 13px;
        line-height: 1.45;
      }
      .ft-alt-locations-block {
        margin-top: 16px;
      }
      .ft-alt-locations-title {
        margin-bottom: 10px;
        font-size: 14px;
        text-transform: uppercase;
        font-weight: 700;
      }
      .ft-alt-locations-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        background: #e8f5e9;
        border-radius: 10px;
        padding: 12px;
      }
      .ft-alt-location-card h4 {
        margin: 0 0 6px;
        font-size: 16px;
        text-transform: uppercase;
      }
      .ft-alt-location-address,
      .ft-alt-location-meta,
      .ft-alt-location-card p {
        margin: 0 0 6px;
        font-size: 12px;
        line-height: 1.4;
      }
      @media print {
        body {
          padding: 0;
          background: #FCFBF9;
        }
        .ft-book {
          width: auto;
        }
        .ft-page {
          width: auto;
          min-height: auto;
          margin: 0;
          border: none;
          box-shadow: none;
        }
        .ft-page-inner {
          padding: 12mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="ft-book">
      <section class="ft-page ft-cover">
        <div class="ft-page-inner">
          <img class="ft-logo-mark" src="${logoUrl}" alt="FlipTrip"/>
          <h1>${htmlEscape(title)}</h1>
          ${subtitle ? `<div class="ft-subtitle">${htmlEscape(subtitle)}</div>` : ''}
          ${previewImage ? `<img class="ft-hero" src="${htmlEscape(previewImage)}" alt="${htmlEscape(title)}"/>` : ''}
          ${aboutTripParagraphs.length ? `<div class="ft-cover-about">${aboutTripParagraphs.map((p) => `<p>${htmlEscape(p)}</p>`).join('')}</div>` : ''}
        </div>
      </section>
      <div id="ft-content-pages"></div>
      <div id="ft-flow-source" style="display:none;">
        ${sectionsHtml}
        ${mapHtml}
        ${locationsHtml}
      </div>
    </div>
    <script>
      (function () {
        const CONTENT_MAX_HEIGHT = 1190;
        const source = document.getElementById('ft-flow-source');
        const pagesRoot = document.getElementById('ft-content-pages');
        if (!source || !pagesRoot) return;

        const blocks = Array.from(source.children);
        const createPage = () => {
          const page = document.createElement('section');
          page.className = 'ft-page';
          const inner = document.createElement('div');
          inner.className = 'ft-page-inner';
          page.appendChild(inner);
          pagesRoot.appendChild(page);
          return inner;
        };

        const fits = (inner) => inner.scrollHeight <= CONTENT_MAX_HEIGHT;
        let inner = createPage();

        for (let i = 0; i < blocks.length; i += 1) {
          const block = blocks[i].cloneNode(true);
          const keepWithNext = block.dataset.keepWithNext === 'true' && i + 1 < blocks.length;

          if (keepWithNext) {
            const next = blocks[i + 1].cloneNode(true);
            inner.appendChild(block);
            inner.appendChild(next);
            if (!fits(inner) && inner.children.length > 2) {
              inner.removeChild(next);
              inner.removeChild(block);
              inner = createPage();
              inner.appendChild(block);
              inner.appendChild(next);
            }
            i += 1;
            continue;
          }

          inner.appendChild(block);
          if (!fits(inner) && inner.children.length > 1) {
            inner.removeChild(block);
            inner = createPage();
            inner.appendChild(block);
          }
        }

        const allImages = Array.from(document.querySelectorAll('img'));
        const waiters = allImages.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        });

        Promise.all(waiters).then(() => {
          document.querySelectorAll('.ft-adaptive-grid').forEach((grid) => {
            const main = grid.querySelector('.ft-main-photo');
            if (!main) return;
            const w = main.naturalWidth || 0;
            const h = main.naturalHeight || 0;
            if (w >= h && w > 0) {
              grid.classList.add('is-landscape');
            }
          });
          window.__FT_PDF_LAYOUT_READY = true;
        });
      })();
    </script>
  </body>
</html>`;
}

async function renderStyledPdfViaHtml({ tour, blocks, template = 'classic', layout = {} }) {
  const locations = extractLocationsFromBlocks(blocks);
  const mapUrl = await buildMapboxStaticUrl(locations, template, {
    cityName: tour?.city?.name || '',
    tourTitle: tour?.title || tour?.draft_data?.title || '',
    tourDescription: tour?.description || tour?.draft_data?.description || ''
  });
  const html = buildStyledPdfHtml({ tour, blocks, template, layout, mapUrl, locations });

  const [{ default: chromium }, { default: playwright }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('playwright-core')
  ]);

  const executablePath = await chromium.executablePath();
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath,
    headless: true
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__FT_PDF_LAYOUT_READY === true, { timeout: 5000 }).catch(() => null);
    await page.emulateMedia({ media: 'screen' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      }
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function ensurePageSpace(doc, y, minSpace = 90) {
  if (y + minSpace <= doc.page.height - doc.page.margins.bottom) return y;
  doc.addPage();
  return 50;
}

function paragraph(doc, text, { x, y, width, fontSize = 11, color = '#111827', lineGap = 2 }) {
  const safe = String(text || '').trim();
  if (!safe) return y;
  doc.fillColor(color).fontSize(fontSize).text(safe, x, y, { width, lineGap });
  return y + doc.heightOfString(safe, { width, lineGap }) + 8;
}

function heading(doc, text, { x, y, width, fontSize = 18, color = '#111827' }) {
  const safe = String(text || '').trim();
  if (!safe) return y;
  doc.fillColor(color).fontSize(fontSize).text(safe, x, y, { width });
  return y + doc.heightOfString(safe, { width }) + 8;
}

function extractBlockNarrativeSections(blocks = []) {
  const sections = [];
  (blocks || []).forEach((block) => {
    const content = block?.content || {};
    const type = block?.block_type;

    if (type === 'text') {
      const text = String(content.text || '').trim();
      if (text) sections.push({ type: 'text', title: null, text });
      return;
    }

    if (type === 'heading') {
      const title = String(content.text || content.title || '').trim();
      if (title) sections.push({ type: 'heading', title, text: null });
      return;
    }

    if (type === 'location') {
      const main = content.mainLocation || content;
      const title = String(main?.title || main?.name || '').trim();
      const address = String(main?.address || '').trim();
      const description = String(main?.description || '').trim();
      const recommendations = String(main?.recommendations || '').trim();
      if (title || description || recommendations) {
        sections.push({
          type: 'location',
          title,
          address,
          text: [description, recommendations].filter(Boolean).join('\n\n')
        });
      }
      return;
    }

    if (type === 'photo_text' || type === 'fullwidth_image') {
      const title = String(content.title || '').trim();
      const text = String(content.text || content.caption || '').trim();
      if (title || text) sections.push({ type: 'text', title, text });
      return;
    }
  });
  return sections;
}

async function renderStyledPdf({ tour, blocks, template = 'classic', layout = {} }) {
  const cfg = templateConfig(template);
  const locations = extractLocationsFromBlocks(blocks);
  const sections = extractBlockNarrativeSections(blocks);
  const mapUrl = await buildMapboxStaticUrl(locations, template, {
    cityName: tour?.city?.name || '',
    tourTitle: tour?.title || tour?.draft_data?.title || '',
    tourDescription: tour?.description || tour?.draft_data?.description || ''
  });
  const mapImageBuffer = mapUrl
    ? await fetch(mapUrl).then(async (resp) => (resp.ok ? Buffer.from(await resp.arrayBuffer()) : null)).catch(() => null)
    : null;

  const title = String(tour?.draft_data?.title || tour?.title || 'FlipTrip Guide');
  const city = String(tour?.city?.name || '').trim();
  const subtitle = String(
    layout?.subtitle ||
    tour?.draft_data?.shortDescription ||
    tour?.description ||
    `A curated route${city ? ` in ${city}` : ''}`
  ).trim();

  const highlights = tour?.draft_data?.highlights || {};
  const highlightTexts = [highlights.text3, highlights.text4, highlights.text5].filter(Boolean).map((s) => String(s).trim());

  const doc = new PDFDocument({ size: 'A4', margin: 44 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', resolve));

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = 50;

  doc.fillColor(cfg.accent).fontSize(13).text('FLIPTRIP', 44, y);
  y += 22;
  doc.fillColor('#111827').fontSize(28).text(title, 44, y, { width: pageWidth });
  y += doc.heightOfString(title, { width: pageWidth }) + 10;
  doc.fillColor(cfg.muted).fontSize(13).text(subtitle, 44, y, { width: pageWidth, lineGap: 2 });
  y += doc.heightOfString(subtitle, { width: pageWidth, lineGap: 2 }) + 14;

  if (mapImageBuffer) {
    y = ensurePageSpace(doc, y, 240);
    doc.roundedRect(44, y, pageWidth, 220, 10).strokeColor('#E5E7EB').stroke();
    doc.image(mapImageBuffer, 44, y, { fit: [pageWidth, 220] });
    y += 236;
  }

  if (layout?.includeHighlights !== false && highlightTexts.length > 0) {
    y = ensurePageSpace(doc, y, 120);
    doc.fillColor('#111827').fontSize(16).text('What’s inside this walk', 44, y);
    y += 26;
    highlightTexts.forEach((line, index) => {
      y = ensurePageSpace(doc, y, 36);
      doc.fillColor(cfg.accent).fontSize(12).text(`${index + 1}.`, 44, y + 2);
      doc.fillColor('#1F2937').fontSize(12).text(line, 62, y, { width: pageWidth - 18, lineGap: 2 });
      y += doc.heightOfString(line, { width: pageWidth - 18, lineGap: 2 }) + 8;
    });
    y += 8;
  }

  y = ensurePageSpace(doc, y, 70);
  doc.fillColor('#111827').fontSize(16).text('Locations', 44, y);
  y += 24;

  locations.forEach((loc, index) => {
    y = ensurePageSpace(doc, y, 44);
    doc.fillColor(cfg.accent).fontSize(12).text(`${index + 1}.`, 44, y + 1);
    doc.fillColor('#111827').fontSize(12).text(loc.name, 62, y, { width: pageWidth - 20 });
    y += doc.heightOfString(loc.name, { width: pageWidth - 20 }) + 2;
    if (loc.address) {
      doc.fillColor('#6B7280').fontSize(10).text(loc.address, 62, y, { width: pageWidth - 20 });
      y += doc.heightOfString(loc.address, { width: pageWidth - 20 }) + 2;
    }
    y += 4;
  });

  if (sections.length > 0) {
    y = ensurePageSpace(doc, y, 90);
    y += 6;
    y = heading(doc, 'Guide content', { x: 44, y, width: pageWidth, fontSize: 16, color: '#111827' });

    sections.slice(0, 120).forEach((section) => {
      y = ensurePageSpace(doc, y, 80);
      if (section.type === 'heading') {
        y = heading(doc, section.title, { x: 44, y, width: pageWidth, fontSize: 20, color: '#111827' });
        return;
      }
      if (section.title) {
        y = heading(doc, section.title, { x: 44, y, width: pageWidth, fontSize: 14, color: '#111827' });
      }
      if (section.address) {
        y = paragraph(doc, section.address, { x: 44, y, width: pageWidth, fontSize: 10, color: '#6B7280' });
      }
      if (section.text) {
        y = paragraph(doc, section.text, { x: 44, y, width: pageWidth, fontSize: 11, color: '#1F2937', lineGap: 2 });
      }
    });
  }

  doc.end();
  await endPromise;
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'https://fliptrip-clean-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    if (!supabase) return res.status(500).json({ success: false, error: 'Database not configured' });

    const { tourId, template = 'classic', layout = {}, previewHtml = false } = req.body || {};
    if (!tourId) return res.status(400).json({ success: false, error: 'tourId is required' });

    const { userId, isAdmin } = await getUserFromToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const allowed = await canEditTour(tourId, userId, isAdmin);
    if (!allowed) return res.status(403).json({ success: false, error: 'You can only edit your own tours' });

    const { data: tour, error: tourErr } = await supabase
      .from('tours')
      .select('id,title,description,draft_data,city:cities(name)')
      .eq('id', tourId)
      .maybeSingle();
    if (tourErr || !tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    const { data: blocks, error: blocksErr } = await supabase
      .from('tour_content_blocks')
      .select('id,block_type,content,order_index')
      .eq('tour_id', tourId)
      .order('order_index', { ascending: true });
    if (blocksErr) {
      return res.status(500).json({ success: false, error: 'Failed to load tour blocks' });
    }

    if (previewHtml) {
      const locations = extractLocationsFromBlocks(blocks || []);
      const mapUrl = await buildMapboxStaticUrl(locations, template, {
        cityName: tour?.city?.name || '',
        tourTitle: tour?.title || tour?.draft_data?.title || '',
        tourDescription: tour?.description || tour?.draft_data?.description || ''
      });
      const html = buildStyledPdfHtml({
        tour,
        blocks: blocks || [],
        template,
        layout,
        mapUrl,
        locations
      });
      return res.status(200).json({
        success: true,
        previewHtml: html,
        template,
        mapIncluded: !!mapUrl,
        mapIssue: mapUrl ? null : (!getMapboxToken() ? 'Mapbox token is missing in backend environment (MAPBOX_ACCESS_TOKEN).' : 'Could not build map from route points or city center.'),
        locationsCount: locations.length
      });
    }

    const locationsForMap = extractLocationsFromBlocks(blocks || []);
    const mapPreviewUrl = await buildMapboxStaticUrl(locationsForMap, template, {
      cityName: tour?.city?.name || '',
      tourTitle: tour?.title || tour?.draft_data?.title || '',
      tourDescription: tour?.description || tour?.draft_data?.description || ''
    });
    const mapIncluded = !!mapPreviewUrl;
    const mapIssue = mapIncluded
      ? null
      : (!getMapboxToken()
          ? 'Mapbox token is missing in backend environment (MAPBOX_ACCESS_TOKEN).'
          : 'Mapbox map could not be generated from locations.');

    let pdfBuffer = null;
    let renderMode = 'html';
    try {
      pdfBuffer = await renderStyledPdfViaHtml({ tour, blocks: blocks || [], template, layout });
    } catch (htmlRenderError) {
      console.warn('⚠️ HTML PDF render failed, fallback to PDFKit:', htmlRenderError?.message || htmlRenderError);
      renderMode = 'pdfkit-fallback';
      pdfBuffer = await renderStyledPdf({ tour, blocks: blocks || [], template, layout });
    }
    await ensureBucketAllowsPdf();

    const safeTitle = sanitizeFileName(tour.title || 'fliptrip-tour');
    const filePath = `tour-pdfs/${tourId}/styled-${template}-${Date.now()}-${safeTitle}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('tour-assets')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadErr) {
      return res.status(500).json({ success: false, error: uploadErr.message || 'Failed to upload generated PDF' });
    }

    const { data: publicUrlData } = supabase.storage.from('tour-assets').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl || '';

    const existingDraft = (tour.draft_data && typeof tour.draft_data === 'object') ? tour.draft_data : {};
    const mergedDraft = {
      ...existingDraft,
      tourPdfUrl: publicUrl,
      pdfTemplate: template,
      pdfLayout: layout,
      styledPdfGeneratedAt: new Date().toISOString()
    };

    await supabase
      .from('tours')
      .update({ draft_data: mergedDraft })
      .eq('id', tourId);

    return res.status(200).json({
      success: true,
      pdfUrl: publicUrl,
      template,
      renderMode,
      mapIncluded,
      mapIssue,
      locationsCount: locationsForMap.length
    });
  } catch (error) {
    console.error('❌ generate-styled-tour-pdf error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
