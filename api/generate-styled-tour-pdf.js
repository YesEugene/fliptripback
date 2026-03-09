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

function extractLocationsFromBlocks(blocks = []) {
  const all = [];
  const pushLoc = (loc) => {
    if (!loc || typeof loc !== 'object') return;
    const name = String(loc.title || loc.name || '').trim();
    const address = String(loc.address || '').trim();
    const lat = Number(loc.lat ?? loc.latitude ?? loc?.coordinates?.lat);
    const lng = Number(loc.lng ?? loc.longitude ?? loc?.coordinates?.lng);
    if (!name) return;
    all.push({
      name,
      address,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null
    });
  };

  blocks.forEach((block) => {
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

async function buildMapboxStaticUrl(locations = [], template = 'classic') {
  const token = process.env.MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || '';
  if (!token) return null;

  const styleByTemplate = {
    classic: 'mapbox/light-v11',
    magazine: 'mapbox/streets-v12',
    minimal: 'mapbox/light-v11'
  };
  const style = styleByTemplate[template] || styleByTemplate.classic;

  const withCoords = locations.filter((loc) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng));
  const withoutCoords = locations.filter((loc) => !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng));
  let resolved = [...withCoords];

  if (resolved.length < 3 && withoutCoords.length > 0) {
    const geocodeCandidates = withoutCoords.slice(0, 8);
    for (const candidate of geocodeCandidates) {
      const geocoded = await geocodeLocationWithMapbox(candidate, token);
      if (geocoded && Number.isFinite(geocoded.lat) && Number.isFinite(geocoded.lng)) {
        resolved.push(geocoded);
      }
    }
  }

  const finalCoords = resolved.slice(0, 20);
  if (finalCoords.length === 0) return null;

  const overlays = finalCoords
    .map((loc) => `pin-s+e74c3c(${loc.lng},${loc.lat})`)
    .join(',');

  return `https://api.mapbox.com/styles/v1/${style}/static/${overlays}/auto/1200x620?padding=70,70,70,70&access_token=${token}`;
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
      sections.push({
        type: 'photo_text',
        title: title || null,
        paragraphs,
        photos: normalizePhotoList(content.photos || content.photo).slice(0, 4),
        useColumns: combined.length > 950
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
          price
        });
      }
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

  const mapHtml = (layout?.includeMap === false || !mapUrl) ? '' : `
    <section class="ft-page">
      <div class="ft-page-inner">
        <section class="ft-section">
          <h2 class="ft-headline">Route map</h2>
          <img class="ft-map" src="${htmlEscape(mapUrl)}" alt="Tour route map"/>
        </section>
      </div>
    </section>
  `;

  const locationsHtml = locations.length === 0 ? '' : `
    <section class="ft-page">
      <div class="ft-page-inner">
        <section class="ft-section">
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
      </div>
    </section>
  `;

  const sectionsHtml = sections.map((section) => {
    if (section.type === 'heading') {
      return `<section class="ft-section ft-heading-block"><h2 class="ft-headline">${htmlEscape(section.title || '')}</h2></section>`;
    }

    const titleHtml = section.title ? `<h3>${htmlEscape(section.title)}</h3>` : '';
    const addressHtml = section.address ? `<div class="ft-address">${htmlEscape(section.address)}</div>` : '';
    const paragraphs = section.paragraphs?.length
      ? section.paragraphs.map((p) => `<p>${htmlEscape(p)}</p>`).join('')
      : '';
    const textWrapClass = section.useColumns ? 'ft-text columns' : 'ft-text';
    const isLocation = section.type === 'location';
    const locationMetaHtml = isLocation && (section.rating || section.price) ? `
      <div class="ft-location-meta">
        ${section.rating ? `<span>★ ${htmlEscape(section.rating)}</span>` : ''}
        ${section.price ? `<span>${htmlEscape(section.price)}</span>` : ''}
      </div>
    ` : '';
    const recommendationsHtml = isLocation && section.recommendations ? `
      <div class="ft-recommend-box">
        <div class="ft-recommend-title">Author also recommends</div>
        <p>${htmlEscape(section.recommendations)}</p>
      </div>
    ` : '';
    const photoGrid = !section.photos?.length ? '' : (isLocation ? `
      <div class="ft-location-photos">
        <div class="ft-location-photo-layout">
          <img class="ft-location-main-photo" src="${htmlEscape(section.photos[0])}" alt="${htmlEscape(section.title || 'Location photo')}"/>
          ${section.photos.length > 1 ? `
          <div class="ft-location-side-grid">
            <div class="ft-location-side-col">
              ${section.photos[1] ? `<img src="${htmlEscape(section.photos[1])}" alt="${htmlEscape(section.title || 'Location photo 2')}"/>` : ''}
              ${section.photos[3] ? `<img src="${htmlEscape(section.photos[3])}" alt="${htmlEscape(section.title || 'Location photo 4')}"/>` : ''}
            </div>
            <div class="ft-location-side-col">
              ${section.photos[2] ? `<img src="${htmlEscape(section.photos[2])}" alt="${htmlEscape(section.title || 'Location photo 3')}"/>` : ''}
              ${section.photos[4] ? `<img src="${htmlEscape(section.photos[4])}" alt="${htmlEscape(section.title || 'Location photo 5')}"/>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    ` : `
      <div class="ft-photo-grid ${section.photos.length > 1 ? 'has-many' : ''}">
        ${section.photos.map((src, i) => `<img src="${htmlEscape(src)}" alt="${htmlEscape(section.title || `Tour image ${i + 1}`)}"/>`).join('')}
      </div>
    `);

    return `
      <section class="ft-section ${isLocation ? 'ft-location-section' : ''}">
        ${photoGrid}
        ${titleHtml}
        ${addressHtml}
        ${locationMetaHtml}
        <div class="${textWrapClass}">
          ${paragraphs}
        </div>
        ${recommendationsHtml}
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
        max-height: 420px;
        object-fit: contain;
        display: block;
        margin-top: 26px;
        background: #f3f4f6;
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
        margin-top: 12px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .ft-heading-block {
        margin-top: 30px;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 27px;
        line-height: 1.2;
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
        font-size: 29px;
      }
      .ft-address {
        color: ${cfg.muted};
        font-size: 14px;
        margin-bottom: 8px;
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
      .ft-photo-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
      }
      .ft-photo-grid img {
        width: 100%;
        height: auto;
        object-fit: contain;
        display: block;
        background: #f3f4f6;
      }
      .ft-photo-grid img:first-child {
        grid-row: span 2;
      }
      .ft-location-photos {
        margin: 12px 0;
      }
      .ft-location-photo-layout {
        display: grid;
        grid-template-columns: 250px 1fr;
        gap: 12px;
        align-items: start;
      }
      .ft-location-main-photo {
        width: 250px;
        height: auto;
        object-fit: contain;
        display: block;
        background: #f3f4f6;
      }
      .ft-location-side-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        display: grid;
        gap: 10px;
      }
      .ft-location-side-col {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ft-location-side-col img {
        width: 100%;
        height: auto;
        object-fit: contain;
        display: block;
        background: #f3f4f6;
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
      @media print {
        body {
          padding: 0;
          background: #fff;
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
      <section class="ft-page">
        <div class="ft-page-inner">
          ${sectionsHtml}
        </div>
      </section>
      ${mapHtml}
      ${locationsHtml}
    </div>
  </body>
</html>`;
}

async function renderStyledPdfViaHtml({ tour, blocks, template = 'classic', layout = {} }) {
  const locations = extractLocationsFromBlocks(blocks);
  const mapUrl = layout?.includeMap === false ? null : await buildMapboxStaticUrl(locations, template);
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
  const mapUrl = layout?.includeMap === false ? null : await buildMapboxStaticUrl(locations, template);
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
      const mapUrl = layout?.includeMap === false ? null : await buildMapboxStaticUrl(locations, template);
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
        locationsCount: locations.length
      });
    }

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
      locationsCount: extractLocationsFromBlocks(blocks || []).length
    });
  } catch (error) {
    console.error('❌ generate-styled-tour-pdf error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
