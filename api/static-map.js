/**
 * Static Map Proxy API
 * Generates a Google Static Map URL using the server-side API key
 * Returns a redirect to the Google Static Maps image
 */

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.flip-trip.com',
    'https://flip-trip.com',
    'https://fliptripfrontend.vercel.app',
    'https://fliptrip-clean-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { markers, size, zoom } = req.query;
    
    if (!markers) {
      return res.status(400).json({ error: 'markers parameter is required' });
    }

    const googleMapsKey = process.env.GOOGLE_MAPS_KEY || process.env.VITE_GOOGLE_MAPS_KEY;
    if (!googleMapsKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const mapSize = size || '700x300';
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=${mapSize}&maptype=roadmap&${markers}${zoom ? `&zoom=${zoom}` : ''}&key=${googleMapsKey}`;
    
    // Redirect to the actual Google Static Maps image
    res.redirect(302, mapUrl);
  } catch (error) {
    console.error('❌ Static map error:', error);
    return res.status(500).json({ error: 'Failed to generate map' });
  }
}
