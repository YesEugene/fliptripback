import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const [usersResp, toursResp] = await Promise.all([
      supabase.from('users').select('id,email,role'),
      supabase.from('tours').select('*').limit(10000)
    ]);

    if (usersResp.error) throw usersResp.error;
    if (toursResp.error) throw toursResp.error;

    const users = usersResp.data || [];
    const tours = toursResp.data || [];

    const authorRoles = new Set(['guide', 'creator']);
    const authorIds = new Set(
      users
        .filter((u) => authorRoles.has(String(u.role || '').toLowerCase()))
        .map((u) => String(u.id))
    );

    const ownerCols = ['guide_id', 'creator_id', 'user_id', 'created_by'];
    const getOwnerId = (tour) => {
      for (const c of ownerCols) {
        if (tour[c]) return String(tour[c]);
      }
      return null;
    };

    const hasFormat = (tour) => {
      if (tour?.default_format === 'self_guided' || tour?.default_format === 'with_guide') return true;
      const settings = tour?.draft_data?.tourSettings;
      return settings?.selfGuided === true || settings?.withGuide === true;
    };

    const normalizeStatus = (tour) => {
      const raw = String(tour?.status || '').toLowerCase();
      if (['approved', 'pending', 'draft', 'rejected'].includes(raw)) return raw;
      if (raw === 'published' || raw === 'active') return 'approved';
      if (tour?.is_published) return 'approved';
      return 'draft';
    };

    const compact = (tour, reason) => ({
      id: tour.id,
      title: tour.title,
      source: tour.source || null,
      status: normalizeStatus(tour),
      created_at: tour.created_at,
      owner_id: getOwnerId(tour),
      guide_id: tour.guide_id || null,
      creator_id: tour.creator_id || null,
      user_id: tour.user_id || null,
      created_by: tour.created_by || null,
      reason
    });

    const generatedTours = tours.filter((t) => String(t.source || '').toLowerCase() === 'user_generated');
    const noOwnerTours = tours.filter((t) => !getOwnerId(t));
    const ownerNotAuthorTours = tours.filter((t) => {
      const ownerId = getOwnerId(t);
      return ownerId && !authorIds.has(ownerId);
    });

    // Matches current admin-tours visibility rules
    const visibleInAdminTours = tours.filter((t) => {
      if (String(t.source || '').toLowerCase() === 'user_generated') return false;
      const status = normalizeStatus(t);
      if (status === 'draft') return false;
      return hasFormat(t);
    });
    const visibleIds = new Set(visibleInAdminTours.map((t) => String(t.id)));

    const hiddenFromAdminTours = tours
      .filter((t) => !visibleIds.has(String(t.id)))
      .map((t) => {
        const isAi = String(t.source || '').toLowerCase() === 'user_generated';
        const status = normalizeStatus(t);
        const format = hasFormat(t);
        let reason = 'other';
        if (isAi) reason = 'ai_source';
        else if (status === 'draft') reason = 'draft_status';
        else if (!format) reason = 'missing_format';
        return compact(t, reason);
      });

    // Location source diagnostics
    const { data: locations } = await supabase.from('locations').select('id,source');
    const locationsBySource = {};
    (locations || []).forEach((l) => {
      const src = l.source || 'unknown';
      locationsBySource[src] = (locationsBySource[src] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalTours: tours.length,
        visibleInAdminTours: visibleInAdminTours.length,
        hiddenFromAdminTours: hiddenFromAdminTours.length,
        generatedTours: generatedTours.length,
        noOwnerTours: noOwnerTours.length,
        ownerNotAuthorTours: ownerNotAuthorTours.length,
        totalLocations: (locations || []).length
      },
      locationsBySource,
      noOwnerTours: noOwnerTours.map((t) => compact(t, 'no_owner')),
      ownerNotAuthorTours: ownerNotAuthorTours.map((t) => compact(t, 'owner_not_author')),
      generatedTours: generatedTours.map((t) => compact(t, 'ai_source')),
      hiddenFromAdminTours
    });
  } catch (error) {
    console.error('❌ admin-tour-audit error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

