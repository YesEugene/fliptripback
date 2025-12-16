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

      const { search, category, source, tag_id, verified } = req.query;

      let query = supabase
        .from('locations')
        .select(`
          *,
          city:cities(name),
          interests:location_interests(
            interest:interests(id, name)
          ),
          tags:location_tags(
            tag:tags(id, name)
          )
        `)
        .order('name');

      // Search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Category filter
      if (category) {
        query = query.eq('category', category);
      }

      // Source filter
      if (source) {
        query = query.eq('source', source);
      }

      // Verified filter
      if (verified !== undefined) {
        query = query.eq('verified', verified === 'true');
      }

      // Tag filter (through location_tags)
      if (tag_id) {
        // This requires a subquery - we'll filter after fetching
        // For now, we'll fetch all and filter in memory
      }

      const { data: locations, error } = await query;

      if (error) {
        throw error;
      }

      // Filter by tag_id if provided (in memory)
      let filteredLocations = locations || [];
      if (tag_id) {
        filteredLocations = filteredLocations.filter(location => 
          location.tags?.some(lt => lt.tag?.id === tag_id)
        );
      }

      // Format locations for display
      const formattedLocations = filteredLocations.map(location => ({
        id: location.id,
        name: location.name,
        city: location.city?.name || location.city_id,
        category: location.category || 'N/A',
        verified: location.verified || false,
        address: location.address,
        description: location.description,
        recommendations: location.recommendations,
        website: location.website || null,
        phone: location.phone || null,
        booking_url: location.booking_url || null,
        price_level: location.price_level !== null && location.price_level !== undefined ? location.price_level : 2,
        source: location.source || 'admin',
        google_place_id: location.google_place_id || null,
        interests: location.interests?.map(li => li.interest?.name).filter(Boolean) || [],
        tags: location.tags?.map(lt => lt.tag?.name).filter(Boolean) || []
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

      const { 
        name, 
        city_id, 
        category, 
        address, 
        description, 
        recommendations, 
        tags, 
        interests, 
        photos,
        website,
        phone,
        booking_url,
        price_level,
        source,
        google_place_id
      } = req.body;

      if (!name || !city_id) {
        return res.status(400).json({
          success: false,
          error: 'Name and city_id are required'
        });
      }

      // Get user ID from token for created_by and updated_by
      let userId = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          // Decode base64 token (simple implementation)
          try {
            const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
            userId = payload.userId || payload.id;
          } catch (e) {
            // Token format might be different, try to get from Supabase auth
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id;
          }
        }
      } catch (e) {
        console.log('Could not extract user ID from token:', e.message);
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
          website: website || null,
          phone: phone || null,
          booking_url: booking_url || null,
          price_level: price_level !== undefined ? parseInt(price_level) : 2,
          source: source || 'admin',
          google_place_id: google_place_id || null,
          verified: true,
          created_by: userId,
          updated_by: userId
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

  // Handle PUT/PATCH - update location
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;
      const {
        name,
        city_id,
        category,
        address,
        description,
        recommendations,
        tags,
        interests,
        photos,
        website,
        phone,
        booking_url,
        price_level,
        source,
        google_place_id,
        verified
      } = req.body;

      console.log('📥 PUT /api/admin-locations - ID:', id);
      console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Location ID is required'
        });
      }

      // Get user ID from token for updated_by
      let userId = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
            userId = payload.userId || payload.id;
          } catch (e) {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id;
          }
        }
      } catch (e) {
        console.log('Could not extract user ID from token:', e.message);
      }

      // Build update object (only include provided fields)
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (city_id !== undefined) updateData.city_id = city_id;
      if (category !== undefined) updateData.category = category;
      if (address !== undefined) updateData.address = address;
      if (description !== undefined) updateData.description = description;
      if (recommendations !== undefined) updateData.recommendations = recommendations;
      if (website !== undefined) updateData.website = website;
      if (phone !== undefined) updateData.phone = phone;
      if (booking_url !== undefined) updateData.booking_url = booking_url;
      if (price_level !== undefined) updateData.price_level = parseInt(price_level);
      if (source !== undefined) updateData.source = source;
      if (google_place_id !== undefined) updateData.google_place_id = google_place_id;
      if (verified !== undefined) updateData.verified = verified;
      if (userId) updateData.updated_by = userId;

      console.log('📝 Update data:', JSON.stringify(updateData, null, 2));

      // Update location
      const { data: location, error: updateError } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Supabase update error:', updateError);
        throw updateError;
      }

      console.log('✅ Location updated:', location?.id);

      // Update tags if provided
      if (tags !== undefined && Array.isArray(tags)) {
        // Delete existing tags
        await supabase.from('location_tags').delete().eq('location_id', id);
        
        // Insert new tags
        if (tags.length > 0) {
          const { data: tagsData } = await supabase
            .from('tags')
            .select('id, name')
            .in('name', tags);
          
          if (tagsData && tagsData.length > 0) {
            const tagInserts = tagsData.map(tag => ({
              location_id: id,
              tag_id: tag.id
            }));
            await supabase.from('location_tags').insert(tagInserts);
          }
        }
      }

      // Update interests if provided
      if (interests !== undefined && Array.isArray(interests)) {
        // Delete existing interests
        await supabase.from('location_interests').delete().eq('location_id', id);
        
        // Insert new interests
        if (interests.length > 0) {
          const interestInserts = interests.map(interestId => ({
            location_id: id,
            interest_id: interestId
          }));
          await supabase.from('location_interests').insert(interestInserts);
        }
      }

      // Update photos if provided
      if (photos !== undefined && Array.isArray(photos)) {
        // Delete existing photos
        await supabase.from('location_photos').delete().eq('location_id', id);
        
        // Insert new photos
        if (photos.length > 0) {
          const photoInserts = photos.map((photo, index) => ({
            location_id: id,
            url: photo.url || photo,
            is_primary: index === 0,
            source: photo.source || 'admin'
          }));
          await supabase.from('location_photos').insert(photoInserts);
        }
      }

      console.log(`✅ Location ${id} updated successfully`);

      return res.status(200).json({
        success: true,
        location: location,
        message: 'Location updated successfully'
      });
    } catch (error) {
      console.error('❌ Error updating location:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update location',
        message: error.message
      });
    }
  }

  // Handle DELETE - delete location
  if (req.method === 'DELETE') {
    try {
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: 'Database not configured'
        });
      }

      const { id } = req.query;

      console.log('🗑️ DELETE /api/admin-locations - ID:', id);

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Location ID is required'
        });
      }

      // Delete location (CASCADE will handle related records: location_tags, location_photos, location_interests)
      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ Supabase delete error:', deleteError);
        throw deleteError;
      }

      console.log(`✅ Location ${id} deleted successfully`);

      return res.status(200).json({
        success: true,
        message: 'Location deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting location:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete location',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

