// FlipTrip Clean Backend - Get Itinerary API
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITINERARIES_FILE = path.join(__dirname, '../data/itineraries.json');

// Load itineraries from file
async function loadItineraries() {
  try {
    const data = await fs.readFile(ITINERARIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty object
    return {};
  }
}

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

    console.log(`📖 GET ITINERARY: Loading itinerary ${id}...`);
    
    const itineraries = await loadItineraries();
    const itinerary = itineraries[id];

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    console.log(`✅ GET ITINERARY: Found itinerary ${id}`);
    return res.status(200).json({ 
      success: true, 
      itinerary 
    });

  } catch (error) {
    console.error('❌ GET ITINERARY ERROR:', error.message);
    return res.status(500).json({ 
      error: 'Failed to load itinerary', 
      message: error.message
    });
  }
}

