// FlipTrip Clean Backend - Get Itinerary API (using Vercel KV)
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Itinerary ID is required' });
    }

    console.log(`📖 GET ITINERARY: Loading itinerary ${id} from Vercel KV...`);
    
    // Get from Vercel KV
    const itineraryData = await kv.get(`itinerary:${id}`);

    if (!itineraryData) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // Parse JSON string if needed
    const itinerary = typeof itineraryData === 'string' 
      ? JSON.parse(itineraryData) 
      : itineraryData;

    console.log(`✅ GET ITINERARY: Found itinerary ${id}`);
    return res.status(200).json({ 
      success: true, 
      itinerary 
    });

  } catch (error) {
    console.error('❌ GET ITINERARY ERROR:', error.message);
    
    // Fallback: if KV is not configured
    if (error.message.includes('KV') || error.message.includes('vercel')) {
      return res.status(500).json({ 
        error: 'Vercel KV not configured. Please set up KV storage in Vercel dashboard.',
        message: 'Go to Vercel Dashboard > Storage > Create KV Database'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to load itinerary', 
      message: error.message
    });
  }
}
