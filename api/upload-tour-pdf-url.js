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
    if (size > 50 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Maximum PDF size is 50MB' });
    }

    const normalizedType = String(contentType || '').toLowerCase();
    const safeName = sanitizeFileName(fileName || 'tour-presentation.pdf');
    const isPdfByName = safeName.endsWith('.pdf');
    const isPdfByType = normalizedType === 'application/pdf';
    if (!isPdfByName && !isPdfByType) {
      return res.status(400).json({ success: false, error: 'Only PDF files are allowed' });
    }

    const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    const filePath = `tour-pdfs/${tourId}/${Date.now()}-${finalName}`;

    const { data: signedData, error: signedError } = await supabase.storage
      .from('tour-assets')
      .createSignedUploadUrl(filePath);

    if (signedError || !signedData?.signedUrl) {
      return res.status(500).json({
        success: false,
        error: signedError?.message || 'Failed to create upload URL'
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from('tour-assets')
      .getPublicUrl(filePath);

    return res.status(200).json({
      success: true,
      signedUrl: signedData.signedUrl,
      publicUrl: publicUrlData?.publicUrl || null,
      path: filePath
    });
  } catch (error) {
    console.error('❌ upload-tour-pdf-url error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}

