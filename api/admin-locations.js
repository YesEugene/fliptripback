// Admin Locations API - Returns locations for admin dashboard
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers - allow all origins for now
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

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

  // Handle POST - create new location
  if (req.method === 'POST') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { name, city_id, category, address, description, recommendations, tags, interests, photos } = req.body;

      if (!name || !city_id) {
        return res.status(400).json({
          success: false,
          error: 'Name and city_id are required'
        });
      }

      // Insert location (without tags - they go to separate table)
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({
          name,
          city_id,
          category: category || null,
          address: address || null,
          description: description || null,
          recommendations: recommendations || null,
          verified: true
        })
        .select()
        .single();

      if (locationError) {
        throw locationError;
      }

      // Insert tags if provided (into location_tags table)
      if (tags && Array.isArray(tags) && tags.length > 0 && location) {
        // Get tag IDs by names
        const { data: tagsData } = await supabase
          .from('tags')
          .select('id, name')
          .in('name', tags);
        
        if (tagsData && tagsData.length > 0) {
          const tagInserts = tagsData.map(tag => ({
            location_id: location.id,
            tag_id: tag.id
          }));
          await supabase.from('location_tags').insert(tagInserts);
        }
      }

      // Insert photos if provided
      if (photos && photos.length > 0 && location) {
        const photoInserts = photos.map(photo => ({
          location_id: location.id,
          url: photo.url || photo,
          source: photo.source || 'user'
        }));
        await supabase.from('location_photos').insert(photoInserts);
      }

      // Insert interests if provided
      if (interests && interests.length > 0 && location) {
        const interestInserts = interests.map(interestId => ({
          location_id: location.id,
          interest_id: interestId
        }));
        await supabase.from('location_interests').insert(interestInserts);
      }

      return res.status(201).json({
        success: true,
        location
      });
    } catch (error) {
      console.error('❌ Error creating location:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create location',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

