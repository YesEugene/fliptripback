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

    const { tourId, template = 'classic', layout = {} } = req.body || {};
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

    const pdfBuffer = await renderStyledPdf({ tour, blocks: blocks || [], template, layout });
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
      locationsCount: extractLocationsFromBlocks(blocks || []).length
    });
  } catch (error) {
    console.error('❌ generate-styled-tour-pdf error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
