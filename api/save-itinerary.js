// FlipTrip Clean Backend - Save Itinerary API
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITINERARIES_FILE = path.join(__dirname, '../data/itineraries.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(ITINERARIES_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load itineraries from file
async function loadItineraries() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(ITINERARIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty object
    return {};
  }
}

// Save itineraries to file
async function saveItineraries(itineraries) {
  await ensureDataDir();
  await fs.writeFile(ITINERARIES_FILE, JSON.stringify(itineraries, null, 2), 'utf-8');
}

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

    const itineraries = await loadItineraries();
    
    // Use provided ID or generate new one
    const id = itineraryId || generateId();
    
    // Save itinerary with timestamp
    itineraries[id] = {
      ...itinerary,
      id,
      createdAt: itinerary.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveItineraries(itineraries);

    console.log(`✅ SAVE ITINERARY: Saved itinerary with ID ${id}`);
    return res.status(200).json({ 
      success: true, 
      itineraryId: id,
      itinerary: itineraries[id]
    });

  } catch (error) {
    console.error('❌ SAVE ITINERARY ERROR:', error.message);
    return res.status(500).json({ 
      error: 'Failed to save itinerary', 
      message: error.message
    });
  }
}

