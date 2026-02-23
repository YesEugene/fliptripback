// Google Places Details API endpoint
// Returns detailed information about a place by place_id
// Photos are downloaded and cached in Supabase Storage to avoid repeated Google billing
// COST OPTIMIZATION: Never store or return direct Google Photo URLs

import { Client } from '@googlemaps/google-maps-services-js';
import { supabase } from '../database/db.js';
import cors from 'cors';

const googleMapsClient = new Client({});

// Enable CORS for all routes
const corsHandler = cors({
  origin: true,
  credentials: true
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { place_id } = req.body;

    if (!place_id || typeof place_id !== 'string') {
      return res.status(400).json({ error: 'place_id parameter is required' });
    }

    if (!process.env.GOOGLE_MAPS_KEY) {
      console.error('GOOGLE_MAPS_KEY not configured');
      return res.status(500).json({ 
        error: 'Google Maps API key not configured',
        message: 'Please set GOOGLE_MAPS_KEY environment variable in Vercel backend settings. See GOOGLE_MAPS_KEY_SETUP.md for instructions.',
        hint: 'Add GOOGLE_MAPS_KEY to your Vercel backend project Environment Variables'
      });
    }

    // Call Google Places Details API
    // Requesting all fields we need for the location form
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: place_id,
        key: process.env.GOOGLE_MAPS_KEY,
        language: 'en',
        // Optimized field selection to reduce Google API costs:
        // Basic fields (free): name, formatted_address, geometry, place_id, types
        // Atmosphere fields ($5/1000): rating, user_ratings_total, price_level  
        // Photos (separate billing): photos
        // Removed Contact fields ($3/1000 saved): website, international_phone_number, opening_hours, address_components
        fields: [
          'name',
          'formatted_address',
          'rating',
          'user_ratings_total',
          'price_level',
          'types',
          'geometry',
          'photos',
          'place_id'
        ]
      }
    });

    if (response.data.status !== 'OK') {
      console.error('Google Places Details error:', response.data.status, response.data.error_message);
      
      // Check for billing/payment related errors
      if (response.data.status === 'REQUEST_DENIED' || response.data.error_message?.includes('billing') || response.data.error_message?.includes('payment')) {
        return res.status(402).json({ 
          error: 'Google Places API billing error',
          status: response.data.status,
          message: response.data.error_message || 'Google Places API requires billing to be enabled. Please check your Google Cloud Console billing settings.',
          requiresBilling: true
        });
      }
      
      return res.status(500).json({ 
        error: 'Google Places API error',
        status: response.data.status,
        message: response.data.error_message || 'Unknown error'
      });
    }

    const place = response.data.result;

    // Extract city and country from formatted_address (no longer using address_components to save API costs)
    let cityName = null;
    let countryName = null;
    
    if (place.formatted_address) {
      const parts = place.formatted_address.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // Last part is usually the country
        countryName = parts[parts.length - 1];
        // Second to last is usually city or region
        const cityPart = parts[parts.length - 2];
        // Remove postal code if present
        cityName = cityPart.replace(/^\d+\s*/, '').trim();
      }
    }

    // Calculate approximate cost based on price_level
    // price_level: 0 = free, 1 = inexpensive, 2 = moderate, 3 = expensive, 4 = very expensive
    const euroSign = '\u20AC';
    const priceLevelMap = {
      0: 'Free',
      1: euroSign,
      2: euroSign + euroSign,
      3: euroSign + euroSign + euroSign,
      4: euroSign + euroSign + euroSign + euroSign
    };

    const approximateCostMap = {
      0: 'Free',
      1: euroSign + '5-10',
      2: euroSign + '10-30',
      3: euroSign + '30-60',
      4: euroSign + '60+'
    };

    // Format response for frontend
    const formattedPlace = {
      place_id: place.place_id,
      name: place.name || '',
      address: place.formatted_address || '',
      rating: place.rating || null,
      user_ratings_total: place.user_ratings_total || 0,
      price_level: place.price_level !== undefined && place.price_level !== null ? priceLevelMap[place.price_level] || '' : '',
      price_level_numeric: place.price_level !== undefined && place.price_level !== null ? place.price_level : null,
      approximate_cost: place.price_level !== undefined && place.price_level !== null ? approximateCostMap[place.price_level] || '' : '',
      types: place.types || [],
      location: place.geometry?.location ? {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      } : null,
      // Photos will be cached in Supabase Storage to avoid repeated Google billing
      photos: [], // Will be populated below
      photo_url: null, // Will be populated below
      website: null, // No longer fetched from Google to save API costs (Contact fields removed)
      phone: null,
      opening_hours: null,
      // City and country extracted from formatted_address
      city_name: cityName,
      country_name: countryName
    };

    // Cache photos in Supabase Storage (download from Google once, serve free from Supabase)
    if (place.photos && place.photos.length > 0) {
      const photoRefs = place.photos.slice(0, 5); // Limit to 5 photos to reduce Google billing
      const cachedPhotos = [];

      for (const photoData of photoRefs) {
        try {
          const cachedUrl = await cachePhotoInSupabase(place.place_id, photoData.photo_reference);
          if (cachedUrl) {
            cachedPhotos.push(cachedUrl);
          } else {
            // CRITICAL: Do NOT fallback to direct Google URL - costs ~$7/1000 loads!
            // Skip this photo. The frontend shows a placeholder for missing photos.
            console.warn('Photo caching returned null, skipping (no Google URL fallback)');
          }
        } catch (cacheErr) {
          // CRITICAL: Do NOT fallback to direct Google URL - costs ~$7/1000 loads!
          console.warn('Photo caching failed, skipping:', cacheErr.message);
        }
      }

      formattedPlace.photos = cachedPhotos;
      formattedPlace.photo_url = cachedPhotos[0] || null;
    }

    return res.status(200).json({
      success: true,
      place: formattedPlace
    });

  } catch (error) {
    console.error('Error in google-places-details:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * Download a Google Place photo and cache it in Supabase Storage
 * Returns the public Supabase URL, or null if caching fails
 */
async function cachePhotoInSupabase(placeId, photoReference) {
  if (!supabase || !placeId || !photoReference) return null;

  const fileName = 'place-photos/' + placeId + '/' + photoReference.substring(0, 40) + '.jpg';
  const dirPath = 'place-photos/' + placeId;
  const fileBaseName = photoReference.substring(0, 40) + '.jpg';

  // Check if photo already exists in storage
  try {
    const { data: files } = await supabase.storage
      .from('tour-assets')
      .list(dirPath, { limit: 100 });

    if (files && files.some(f => f.name === fileBaseName)) {
      const { data: urlData } = supabase.storage
        .from('tour-assets')
        .getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        console.log('Photo already cached:', fileBaseName);
        return urlData.publicUrl;
      }
    }
  } catch (e) {
    // Storage bucket might not exist yet, continue to create
  }

  // Download photo from Google (one-time cost to cache in Supabase)
  const googlePhotoUrl = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=' + photoReference + '&key=' + process.env.GOOGLE_MAPS_KEY;

  const photoResponse = await fetch(googlePhotoUrl, { redirect: 'follow' });
  if (!photoResponse.ok) {
    console.warn('Failed to download photo from Google:', photoResponse.status);
    return null;
  }

  const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
  const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('tour-assets')
    .upload(fileName, photoBuffer, {
      contentType,
      upsert: true
    });

  if (uploadError) {
    console.warn('Failed to upload photo to Supabase:', uploadError.message);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('tour-assets')
    .getPublicUrl(fileName);

  console.log('Cached photo:', fileName);
  return urlData?.publicUrl || null;
}
