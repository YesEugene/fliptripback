// Smart Itinerary API v3 - Using modular architecture
// This is the new version that uses ItineraryPipeline

import { ItineraryPipeline } from '../services/ItineraryPipeline.js';
import { supabase } from '../database/db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      city,
      audience,
      interests,
      interest_ids,
      date,
      date_from,
      date_to,
      budget,
      previewOnly = false,
      category_id,
      subcategory_id
    } = req.body;

    // Support both interests (legacy) and interest_ids (new system)
    let interestIds = [];
    if (interest_ids) {
      if (Array.isArray(interest_ids)) {
        interestIds = interest_ids;
      } else if (typeof interest_ids === 'string') {
        interestIds = interest_ids.split(',').map(id => id.trim()).filter(id => id);
      } else {
        interestIds = [interest_ids];
      }
    }
    const interestsList = interests || [];

    // Use date_from if provided, otherwise fall back to date (legacy support)
    const itineraryDate = date_from || date || new Date().toISOString().slice(0, 10);

    console.log('🚀 Smart Itinerary v3: Starting generation', {
      city,
      audience,
      interestIds: interestIds.length,
      previewOnly
    });

    // Get interest names by IDs if interestIds provided
    let interestsForConcept = interestsList;
    if (interestIds.length > 0 && interestsList.length === 0) {
      try {
        const { data: interestsData, error: interestsError } = await supabase
          .from('interests')
          .select('id, name')
          .in('id', interestIds.map(id => String(id)));

        if (!interestsError && interestsData && interestsData.length > 0) {
          interestsForConcept = interestsData.map(i => i.name);
          console.log('📋 Got interest names from DB:', interestsForConcept);
        }
      } catch (err) {
        console.error('❌ Error getting interests from DB:', err);
      }
    }

    // Use ItineraryPipeline to generate itinerary
    const pipeline = new ItineraryPipeline();
    const itinerary = await pipeline.generateItinerary({
      city,
      audience,
      interests: interestsForConcept, // Use names for concept generation
      interest_ids: interestIds, // Use IDs for location filtering
      date: itineraryDate,
      date_from,
      date_to,
      budget,
      previewOnly
    });

    console.log('✅ Smart Itinerary v3: Generation complete');
    return res.status(200).json(itinerary);

  } catch (error) {
    console.error('❌ Smart Itinerary v3: Error', error);
    return res.status(500).json({
      error: 'Generation failed',
      message: error.message
    });
  }
}

