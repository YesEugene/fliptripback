// ItineraryStorageService - Handles saving/loading itineraries
// Isolated service for storage operations (Redis, DB, etc.)

import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

export class ItineraryStorageService {
  constructor() {
    // Initialize Redis client using same logic as save-itinerary.js
    this.redis = this.getRedis();
  }

  getRedis() {
    const url = process.env.FTSTORAGE_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.FTSTORAGE_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    
    if (!url || !token) {
      console.warn('⚠️ Redis credentials not found, using in-memory fallback');
      this.memoryStore = new Map();
      return null;
    }
    
    return new Redis({ url, token });
  }

  /**
   * Save preview itinerary
   */
  async savePreview(itinerary) {
    console.log('💾 ItineraryStorageService: Saving preview...');
    
    const itineraryId = uuidv4();
    const dataToSave = {
      ...itinerary,
      previewOnly: true,
      createdAt: new Date().toISOString()
    };

    try {
      if (this.redis) {
        await this.redis.set(`itinerary:${itineraryId}`, JSON.stringify(dataToSave), { ex: 60 * 60 * 24 * 30 }); // 30 days TTL
      } else if (this.memoryStore) {
        this.memoryStore.set(itineraryId, dataToSave);
      } else {
        throw new Error('No storage available');
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
    
    const itineraryId = existingId || uuidv4();
    const dataToSave = {
      ...itinerary,
      previewOnly: false,
      updatedAt: new Date().toISOString()
    };

    try {
      if (this.redis) {
        await this.redis.set(`itinerary:${itineraryId}`, JSON.stringify(dataToSave), { ex: 60 * 60 * 24 * 30 }); // 30 days TTL
      } else if (this.memoryStore) {
        this.memoryStore.set(itineraryId, dataToSave);
      } else {
        throw new Error('No storage available');
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
      
      if (this.redis) {
        const raw = await this.redis.get(`itinerary:${itineraryId}`);
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else if (this.memoryStore) {
        data = this.memoryStore.get(itineraryId);
      } else {
        return { success: false, error: 'No storage available' };
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
      
      if (this.redis) {
        const raw = await this.redis.get(`itinerary:${itineraryId}`);
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else if (this.memoryStore) {
        data = this.memoryStore.get(itineraryId);
      } else {
        return { success: false, error: 'No storage available' };
      }

      if (!data) {
        return { success: false, error: 'Itinerary not found' };
      }

      // Update previewOnly flag
      data.previewOnly = false;
      data.unlockedAt = new Date().toISOString();

      // Save updated data
      if (this.redis) {
        await this.redis.set(`itinerary:${itineraryId}`, JSON.stringify(data), { ex: 60 * 60 * 24 * 30 });
      } else if (this.memoryStore) {
        this.memoryStore.set(itineraryId, data);
      }

      return { success: true, itinerary: data };
    } catch (error) {
      console.error('❌ Error unlocking itinerary:', error);
      return { success: false, error: error.message };
    }
  }
}

