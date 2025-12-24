// Google Places Details API endpoint
// Returns detailed information about a place by place_id

import { Client } from '@googlemaps/google-maps-services-js';
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
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    // Call Google Places Details API
    // Requesting all fields we need for the location form
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: place_id,
        key: process.env.GOOGLE_MAPS_KEY,
        language: 'en',
        fields: [
          'name',
          'formatted_address',
          'address_components',
          'rating',
          'user_ratings_total',
          'price_level',
          'types',
          'geometry',
          'photos',
          'website',
          'international_phone_number',
          'opening_hours',
          'place_id'
        ]
      }
    });

    if (response.data.status !== 'OK') {
      console.error('Google Places Details error:', response.data.status, response.data.error_message);
      return res.status(500).json({ 
        error: 'Google Places API error',
        status: response.data.status,
        message: response.data.error_message || 'Unknown error'
      });
    }

    const place = response.data.result;

    // Calculate approximate cost based on price_level
    // price_level: 0 = free, 1 = inexpensive, 2 = moderate, 3 = expensive, 4 = very expensive
    const priceLevelMap = {
      0: 'Free',
      1: '€',
      2: '€€',
      3: '€€€',
      4: '€€€€'
    };

    const approximateCostMap = {
      0: 'Free',
      1: '€5-15',
      2: '€15-30',
      3: '€30-60',
      4: '€60+'
    };

    // Format response for frontend
    const formattedPlace = {
      place_id: place.place_id,
      name: place.name || '',
      address: place.formatted_address || '',
      rating: place.rating || null,
      user_ratings_total: place.user_ratings_total || 0,
      price_level: place.price_level !== undefined ? priceLevelMap[place.price_level] || '' : '',
      price_level_numeric: place.price_level !== undefined ? place.price_level : null,
      approximate_cost: place.price_level !== undefined ? approximateCostMap[place.price_level] || '' : '',
      types: place.types || [],
      location: place.geometry?.location ? {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      } : null,
      photo_url: place.photos && place.photos.length > 0 
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
        : null,
      website: place.website || null,
      phone: place.international_phone_number || null,
      opening_hours: place.opening_hours || null
    };

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

