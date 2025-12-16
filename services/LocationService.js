// LocationService - Handles location search (DB first, Google Places fallback)
// This service is isolated and can be modified without affecting other parts

import { searchLocationsForItinerary } from '../database/services/locationsService.js';
import { getOrCreateCity } from '../database/services/citiesService.js';
import { Client } from '@googlemaps/google-maps-services-js';

export class LocationService {
  constructor() {
    this.googleMapsClient = new Client({});
  }

  /**
   * Find locations for time slots
   * Strategy: DB first, then Google Places as fallback
   */
  async findLocations({ timeSlots, city, interestIds = [] }) {
    console.log('📍 LocationService: Finding locations', { 
      city, 
      timeSlotsCount: timeSlots.length,
      interestIdsCount: interestIds.length 
    });

    // Get city_id from city name
    let cityId = null;
    try {
      cityId = await getOrCreateCity(city, null);
      console.log(`🏙️ City ID for ${city}: ${cityId}`);
    } catch (error) {
      console.error('Error getting city ID:', error);
    }

    const locations = [];

    for (const slot of timeSlots) {
      try {
        let foundLocation = null;

        // STEP 1: Search in database first
        if (cityId) {
          foundLocation = await this.searchInDatabase({
            cityId,
            slot,
            interestIds
          });
        }

        // STEP 2: If not found in DB, use Google Places as fallback
        if (!foundLocation) {
          foundLocation = await this.searchInGooglePlaces({
            slot,
            city
          });
        }

        // STEP 3: If still not found, use fallback
        if (!foundLocation) {
          foundLocation = this.createFallbackLocation(slot, city);
        }

        locations.push({
          ...slot,
          realPlace: foundLocation
        });

      } catch (error) {
        console.error(`❌ Error finding location for ${slot.activity}:`, error.message);
        locations.push({
          ...slot,
          realPlace: this.createFallbackLocation(slot, city)
        });
      }
    }

    console.log(`✅ LocationService: Found ${locations.length} locations`);
    return locations;
  }

  /**
   * Search in database with interestIds filter
   */
  async searchInDatabase({ cityId, slot, interestIds }) {
    try {
      const categories = slot.category ? [slot.category] : [];
      const tags = slot.keywords || [];

      console.log(`🔍 Searching DB: cityId=${cityId}, category=${slot.category}, interestIds=[${interestIds.join(',')}]`);

      // Try with category and interest filter
      let dbResult = await searchLocationsForItinerary(
        cityId,
        categories,
        tags,
        interestIds.length > 0 ? interestIds : [],
        10
      );

      // If no results, try without category but keep interest filter
      if (!dbResult.success || !dbResult.locations || dbResult.locations.length === 0) {
        if (interestIds.length > 0) {
          console.log(`⚠️ No results with category, trying without category but keeping interest filter...`);
          dbResult = await searchLocationsForItinerary(cityId, [], tags, interestIds, 10);
        }
      }

      // Last resort: try without interest filter
      if ((!dbResult.success || !dbResult.locations || dbResult.locations.length === 0) && interestIds.length > 0) {
        console.log(`⚠️ No results with interest filter, trying without...`);
        dbResult = await searchLocationsForItinerary(cityId, categories, tags, [], 10);
      }

      if (dbResult.success && dbResult.locations && dbResult.locations.length > 0) {
        const dbLocation = dbResult.locations[0];
        console.log(`✅ Found in DB: ${dbLocation.name}`);
        return {
          name: dbLocation.name,
          address: dbLocation.address,
          rating: 4.5,
          priceLevel: dbLocation.price_level || 2,
          photos: dbLocation.photos?.map(p => p.url) || [],
          fromDatabase: true,
          locationId: dbLocation.id,
          description: dbLocation.description,
          recommendations: dbLocation.recommendations,
          category: dbLocation.category
        };
      }
    } catch (error) {
      console.error('❌ DB search error:', error);
    }
    return null;
  }

  /**
   * Search in Google Places as fallback
   */
  async searchInGooglePlaces({ slot, city }) {
    try {
      const searchQuery = `${slot.keywords.join(' ')} ${slot.category} in ${city}`;
      console.log(`🔍 Searching Google Places: ${searchQuery}`);

      const response = await this.googleMapsClient.textSearch({
        params: {
          query: searchQuery,
          key: process.env.GOOGLE_MAPS_KEY,
          language: 'en'
        }
      });

      if (response.data.results.length > 0) {
        const place = response.data.results[0];
        console.log(`✅ Found in Google Places: ${place.name}`);
        return {
          name: place.name,
          address: place.formatted_address,
          rating: place.rating || 4.0,
          priceLevel: place.price_level || 2,
          photos: place.photos ? place.photos.slice(0, 3).map(photo =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_KEY}`
          ) : [],
          fromDatabase: false
        };
      }
    } catch (error) {
      console.error('❌ Google Places search error:', error);
    }
    return null;
  }

  /**
   * Create fallback location
   */
  createFallbackLocation(slot, city) {
    return {
      name: slot.activity,
      address: `${city} City Center`,
      rating: 4.0,
      priceLevel: 2,
      photos: [],
      fromDatabase: false
    };
  }
}

