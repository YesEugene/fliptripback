// Google Places Autocomplete API endpoint
// Returns list of places matching the search query

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
    const { query, location, radius } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (!process.env.GOOGLE_MAPS_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    // Call Google Places Autocomplete API
    const response = await googleMapsClient.placeAutocomplete({
      params: {
        input: query,
        key: process.env.GOOGLE_MAPS_KEY,
        language: 'en',
        ...(location && { location: location }), // Optional: bias results to location
        ...(radius && { radius: radius }) // Optional: search radius in meters
      }
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error('Google Places Autocomplete error:', response.data.status, response.data.error_message);
      
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

    // Format predictions for frontend
    const predictions = (response.data.predictions || []).map(prediction => ({
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

