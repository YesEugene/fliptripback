import { getRedis } from './save-itinerary.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { itineraryId } = req.body;

    if (!itineraryId) {
      return res.status(400).json({ success: false, message: 'Itinerary ID is required' });
    }

    const redis = getRedis();

    // Load existing itinerary from Redis
    const itineraryData = await redis.get(`itinerary:${itineraryId}`);
    if (!itineraryData) {
      return res.status(404).json({ success: false, message: 'Itinerary not found' });
    }

    const itinerary = typeof itineraryData === 'string' ? JSON.parse(itineraryData) : itineraryData;

    // Simply update previewOnly flag to false
    const unlockedItinerary = {
      ...itinerary,
      previewOnly: false
    };

    // Save back to Redis
    await redis.set(`itinerary:${itineraryId}`, JSON.stringify(unlockedItinerary), { ex: 60 * 60 * 24 * 30 });

    console.log(`✅ Itinerary ${itineraryId} unlocked (previewOnly set to false)`);
    console.log(`📊 Unlocked itinerary has ${unlockedItinerary.activities?.length || 0} activities, ${unlockedItinerary.daily_plan?.[0]?.blocks?.length || 0} blocks`);

    res.status(200).json({
      success: true,
      itinerary: unlockedItinerary
    });
  } catch (error) {
    console.error('Unlock itinerary error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      message: 'Error unlocking itinerary',
      error: error.message
    });
  }
}

