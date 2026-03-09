import { supabase } from '../database/db.js';

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

function extractStoragePathFromPublicUrl(publicUrl = '') {
  const raw = String(publicUrl || '').trim();
  if (!raw) return '';
  const marker = '/storage/v1/object/public/tour-assets/';
  const idx = raw.indexOf(marker);
  if (idx === -1) return '';
  const pathWithQuery = raw.slice(idx + marker.length);
  return decodeURIComponent(pathWithQuery.split('?')[0] || '');
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
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

    const authHeader = req.headers.authorization;
    const { userId, isAdmin } = await getUserFromToken(authHeader);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { tourId } = req.body || {};
    if (!tourId) return res.status(400).json({ success: false, error: 'tourId is required' });

    const allowed = await canEditTour(tourId, userId, isAdmin);
    if (!allowed) return res.status(403).json({ success: false, error: 'You can only edit your own tours' });

    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id,draft_data')
      .eq('id', tourId)
      .maybeSingle();

    if (tourError || !tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    const draft = (tour.draft_data && typeof tour.draft_data === 'object') ? tour.draft_data : {};
    const pdfUrl = String(draft.tourPdfUrl || '').trim();
    const storagePath = extractStoragePathFromPublicUrl(pdfUrl);

    if (storagePath) {
      await supabase.storage.from('tour-assets').remove([storagePath]);
    }

    const nextDraft = {
      ...draft,
      tourPdfUrl: ''
    };

    const { error: updateError } = await supabase
      .from('tours')
      .update({ draft_data: nextDraft })
      .eq('id', tourId);

    if (updateError) {
      return res.status(500).json({ success: false, error: updateError.message || 'Failed to update tour' });
    }

    return res.status(200).json({
      success: true,
      deleted: !!storagePath,
      path: storagePath || null
    });
  } catch (error) {
    console.error('❌ delete-tour-pdf error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
