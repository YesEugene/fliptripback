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

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

async function ensureBucketAllowsPreviewImages() {
  try {
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket('tour-assets');
    if (bucketError || !bucket) return;

    const currentMime = Array.isArray(bucket.allowed_mime_types) ? bucket.allowed_mime_types : null;
    const currentLimit = Number(bucket.file_size_limit || 0);
    const requiredLimit = 10 * 1024 * 1024;

    const requiredMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const needsMimeUpdate =
      Array.isArray(currentMime) &&
      requiredMimes.some((m) => !currentMime.includes(m));
    const needsSizeUpdate = currentLimit > 0 && currentLimit < requiredLimit;

    if (!needsMimeUpdate && !needsSizeUpdate) return;

    const nextMime = currentMime
      ? [...new Set([...currentMime, ...requiredMimes])]
      : null;
    await supabase.storage.updateBucket('tour-assets', {
      public: bucket.public ?? true,
      fileSizeLimit: Math.max(currentLimit || 0, requiredLimit),
      allowedMimeTypes: nextMime || undefined
    });
  } catch (error) {
    console.warn('⚠️ Could not ensure preview image mimes in tour-assets bucket:', error?.message || error);
  }
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

    const { tourId, fileName, contentType, fileSize } = req.body || {};
    if (!tourId) return res.status(400).json({ success: false, error: 'tourId is required' });

    const allowed = await canEditTour(tourId, userId, isAdmin);
    if (!allowed) return res.status(403).json({ success: false, error: 'You can only edit your own tours' });

    const size = Number(fileSize || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid file size' });
    }
    const maxBytes = 10 * 1024 * 1024;
    if (size > maxBytes) {
      return res.status(400).json({ success: false, error: 'Maximum preview image size is 10MB' });
    }

    const safeName = sanitizeFileName(fileName || 'preview.jpg');
    let normalizedType = String(contentType || '').toLowerCase().split(';')[0].trim();

    if (!normalizedType || !ALLOWED_MIME.has(normalizedType)) {
      const lower = safeName.toLowerCase();
      const ext = Object.keys(EXT_TO_MIME).find((e) => lower.endsWith(e));
      if (ext) normalizedType = EXT_TO_MIME[ext];
    }

    if (!ALLOWED_MIME.has(normalizedType)) {
      return res.status(400).json({
        success: false,
        error: 'Only JPG, PNG, GIF, or WebP preview images are allowed'
      });
    }

    const filePath = `tour-previews/${tourId}/${Date.now()}-${safeName}`;

    await ensureBucketAllowsPreviewImages();

    const { data: signedData, error: signedError } = await supabase.storage
      .from('tour-assets')
      .createSignedUploadUrl(filePath);

    if (signedError || !signedData?.signedUrl) {
      return res.status(500).json({
        success: false,
        error: signedError?.message || 'Failed to create upload URL'
      });
    }

    const { data: publicUrlData } = supabase.storage.from('tour-assets').getPublicUrl(filePath);

    const supabaseBaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const signedUrlRaw = signedData.signedUrl || '';
    const normalizedRelativeSignedUrl = signedUrlRaw.startsWith('/')
      ? signedUrlRaw
      : `/${signedUrlRaw}`;
    const uploadUrl = signedUrlRaw.startsWith('http')
      ? signedUrlRaw
      : normalizedRelativeSignedUrl.startsWith('/storage/v1/')
        ? `${supabaseBaseUrl}${normalizedRelativeSignedUrl}`
        : `${supabaseBaseUrl}/storage/v1${normalizedRelativeSignedUrl}`;

    return res.status(200).json({
      success: true,
      signedUrl: signedUrlRaw,
      uploadUrl,
      publicUrl: publicUrlData?.publicUrl || null,
      path: filePath
    });
  } catch (error) {
    console.error('❌ upload-tour-preview-url error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}
