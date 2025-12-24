// Google Places Autocomplete API endpoint
// Returns list of places matching the search query

import cors from 'cors';

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
    const { query, location, radius } = req.body;

    console.log('🔍 Google Places Autocomplete request:', { query, location, radius });

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (!process.env.GOOGLE_MAPS_KEY) {
      console.error('❌ GOOGLE_MAPS_KEY not configured');
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    console.log('✅ GOOGLE_MAPS_KEY configured, length:', process.env.GOOGLE_MAPS_KEY?.length);

    // Call Google Places Autocomplete API directly via HTTP
    // The @googlemaps/google-maps-services-js library doesn't have placeAutocomplete method
    const autocompleteUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = new URLSearchParams({
      input: query.trim(),
      key: process.env.GOOGLE_MAPS_KEY,
      language: 'en'
    });

    // Add optional location bias if provided
    if (location && typeof location === 'string') {
      params.append('location', location);
    }
    if (radius && typeof radius === 'number') {
      params.append('radius', radius.toString());
    }

    console.log('🌐 Calling Google Places Autocomplete API...');
    const apiResponse = await fetch(`${autocompleteUrl}?${params.toString()}`);
    
    if (!apiResponse.ok) {
      throw new Error(`Google Places API returned status ${apiResponse.status}`);
    }

    const response = await apiResponse.json();
    console.log('✅ Google Places API response status:', response.status);

    if (response.status !== 'OK' && response.status !== 'ZERO_RESULTS') {
      console.error('Google Places Autocomplete error:', response.status, response.error_message);
      
      // Check for billing/payment related errors
      if (response.status === 'REQUEST_DENIED' || response.error_message?.includes('billing') || response.error_message?.includes('payment')) {
        return res.status(402).json({ 
          error: 'Google Places API billing error',
          status: response.status,
          message: response.error_message || 'Google Places API requires billing to be enabled. Please check your Google Cloud Console billing settings.',
          requiresBilling: true
        });
      }
      
      return res.status(500).json({ 
        error: 'Google Places API error',
        status: response.status,
        message: response.error_message || 'Unknown error'
      });
    }

    // Format predictions for frontend
    const predictions = (response.predictions || []).map(prediction => ({
      place_id: prediction.place_id,
      description: prediction.description,
      main_text: prediction.structured_formatting?.main_text || prediction.description,
      secondary_text: prediction.structured_formatting?.secondary_text || '',
      types: prediction.types || []
    }));

    return res.status(200).json({
      success: true,
      predictions: predictions
    });

  } catch (error) {
    console.error('Error in google-places-autocomplete:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

