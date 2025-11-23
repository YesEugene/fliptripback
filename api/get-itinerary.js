// FlipTrip Clean Backend - Get Itinerary API (using Upstash Redis)
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

    console.log(`📖 GET ITINERARY: Loading itinerary ${id} from Upstash Redis...`);
    
    // Get from Upstash Redis
    const itineraryData = await redis.get(`itinerary:${id}`);

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
    
    // Fallback: if Redis is not configured
    if (error.message.includes('UPSTASH') || error.message.includes('Redis')) {
      return res.status(500).json({ 
        error: 'Upstash Redis not configured. Please set up Redis in Vercel Marketplace.',
        message: 'Go to Vercel Dashboard > Storage > Marketplace > Create Upstash Redis'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to load itinerary', 
      message: error.message
    });
  }
}
