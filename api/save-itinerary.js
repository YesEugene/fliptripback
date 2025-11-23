// FlipTrip Clean Backend - Save Itinerary API (using Vercel KV)
import { kv } from '@vercel/kv';

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('💾 SAVE ITINERARY: Saving itinerary...');
    const { itinerary, itineraryId } = req.body;

    if (!itinerary) {
      return res.status(400).json({ error: 'Itinerary data is required' });
    }

    // Use provided ID or generate new one
    const id = itineraryId || generateId();
    
    // Prepare itinerary data with metadata
    const itineraryData = {
      ...itinerary,
      id,
      createdAt: itinerary.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Vercel KV
    await kv.set(`itinerary:${id}`, JSON.stringify(itineraryData), {
      ex: 60 * 60 * 24 * 30 // Expire after 30 days
    });

    console.log(`✅ SAVE ITINERARY: Saved itinerary with ID ${id} to Vercel KV`);
    return res.status(200).json({ 
      success: true, 
      itineraryId: id,
      itinerary: itineraryData
    });

  } catch (error) {
    console.error('❌ SAVE ITINERARY ERROR:', error.message);
    
    // Fallback: if KV is not configured, return error with instructions
    if (error.message.includes('KV') || error.message.includes('vercel')) {
      return res.status(500).json({ 
        error: 'Vercel KV not configured. Please set up KV storage in Vercel dashboard.',
        message: 'Go to Vercel Dashboard > Storage > Create KV Database'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to save itinerary', 
      message: error.message
    });
  }
}
