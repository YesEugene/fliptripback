// ItineraryStorageService - Handles saving/loading itineraries
// Isolated service for storage operations (Redis, DB, etc.)

import { createClient } from '@vercel/kv';

export class ItineraryStorageService {
  constructor() {
    // Initialize Redis client if KV_URL is available
    if (process.env.KV_URL && process.env.KV_REST_API_TOKEN) {
      this.kv = createClient({
        url: process.env.KV_URL,
        token: process.env.KV_REST_API_TOKEN
      });
    } else {
      console.warn('⚠️ KV credentials not found, storage will use in-memory fallback');
      this.memoryStore = new Map();
    }
  }

  /**
   * Save preview itinerary
   */
  async savePreview(itinerary) {
    console.log('💾 ItineraryStorageService: Saving preview...');
    
    const itineraryId = `itinerary:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dataToSave = {
      ...itinerary,
      previewOnly: true,
      createdAt: new Date().toISOString()
    };

    try {
      if (this.kv) {
        await this.kv.set(itineraryId, JSON.stringify(dataToSave), { ex: 86400 }); // 24 hours TTL
      } else {
        this.memoryStore.set(itineraryId, dataToSave);
      }
      
      console.log('✅ Preview saved with ID:', itineraryId);
      return { success: true, itineraryId };
    } catch (error) {
      console.error('❌ Error saving preview:', error);
      throw error;
    }
  }

  /**
   * Save full itinerary (after payment)
   */
  async saveFull(itinerary, existingId) {
    console.log('💾 ItineraryStorageService: Saving full itinerary...', existingId);
    
    const itineraryId = existingId || `itinerary:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dataToSave = {
      ...itinerary,
      previewOnly: false,
      updatedAt: new Date().toISOString()
    };

    try {
      if (this.kv) {
        await this.kv.set(itineraryId, JSON.stringify(dataToSave), { ex: 86400 * 7 }); // 7 days TTL
      } else {
        this.memoryStore.set(itineraryId, dataToSave);
      }
      
      console.log('✅ Full itinerary saved with ID:', itineraryId);
      return { success: true, itineraryId };
    } catch (error) {
      console.error('❌ Error saving full itinerary:', error);
      throw error;
    }
  }

  /**
   * Load itinerary by ID
   */
  async load(itineraryId, isFullPlan = false) {
    console.log('📥 ItineraryStorageService: Loading itinerary...', { itineraryId, isFullPlan });

    try {
      let data;
      
      if (this.kv) {
        const raw = await this.kv.get(itineraryId);
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else {
        data = this.memoryStore.get(itineraryId);
      }

      if (!data) {
        return { success: false, error: 'Itinerary not found' };
      }

      // If requesting full plan, ensure previewOnly is false
      if (isFullPlan && data.previewOnly === true) {
        data.previewOnly = false;
      }

      return { success: true, itinerary: data };
    } catch (error) {
      console.error('❌ Error loading itinerary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unlock full itinerary after payment
   */
  async unlock(itineraryId) {
    console.log('🔓 ItineraryStorageService: Unlocking itinerary...', itineraryId);

    try {
      let data;
      
      if (this.kv) {
        const raw = await this.kv.get(itineraryId);
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else {
        data = this.memoryStore.get(itineraryId);
      }

      if (!data) {
        return { success: false, error: 'Itinerary not found' };
      }

      // Update previewOnly flag
      data.previewOnly = false;
      data.unlockedAt = new Date().toISOString();

      // Save updated data
      if (this.kv) {
        await this.kv.set(itineraryId, JSON.stringify(data), { ex: 86400 * 7 });
      } else {
        this.memoryStore.set(itineraryId, data);
      }

      return { success: true, itinerary: data };
    } catch (error) {
      console.error('❌ Error unlocking itinerary:', error);
      return { success: false, error: error.message };
    }
  }
}

