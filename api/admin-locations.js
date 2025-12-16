// Admin Locations API - Returns locations for admin dashboard
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { search } = req.query;

      let query = supabase
        .from('locations')
        .select(`
          *,
          city:cities(name),
          interests:location_interests(
            interest:interests(id, name)
          )
        `)
        .order('name');

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data: locations, error } = await query;

      if (error) {
        throw error;
      }

      // Format locations for display
      const formattedLocations = (locations || []).map(location => ({
        id: location.id,
        name: location.name,
        city: location.city?.name || location.city_id,
        category: location.category || 'N/A',
        verified: location.verified || false,
        address: location.address,
        description: location.description,
        recommendations: location.recommendations,
        interests: location.interests?.map(li => li.interest?.name).filter(Boolean) || []
      }));

      return res.status(200).json({
        success: true,
        locations: formattedLocations
      });
    } catch (error) {
      console.error('❌ Error fetching locations:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch locations',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

