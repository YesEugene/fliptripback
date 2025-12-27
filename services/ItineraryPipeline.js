// ItineraryPipeline - Orchestrates the entire itinerary generation flow
// This is the main entry point that coordinates all steps

import { LocationService } from './LocationService.js';
import { ContentGenerationService } from './ContentGenerationService.js';
import { ContentBlocksGenerationService } from './ContentBlocksGenerationService.js';
import { ItineraryStorageService } from './ItineraryStorageService.js';
import { ItineraryStateService } from './ItineraryStateService.js';
import { BudgetService } from './BudgetService.js';

export class ItineraryPipeline {
  constructor() {
    this.locationService = new LocationService();
    this.contentService = new ContentGenerationService();
    this.blocksService = new ContentBlocksGenerationService();
    this.storageService = new ItineraryStorageService();
    this.stateService = new ItineraryStateService();
    this.budgetService = new BudgetService();
  }

  /**
   * Main pipeline: Generate itinerary from start to finish
   * @param {Object} params - All input parameters
   * @returns {Object} Complete itinerary
   */
  async generateItinerary(params) {
    const {
      city,
      audience,
      interests,
      interest_ids,
      date,
      date_from,
      date_to,
      budget,
      previewOnly = false
    } = params;

    console.log('🚀 ItineraryPipeline: Starting generation', { city, audience, previewOnly });

    try {
      // STEP 1: Generate day concept (time slots)
      // Use interest names (interests) not IDs for concept generation
      const dayConcept = await this.contentService.generateDayConcept({
        city,
        audience,
        interests: interests || [],
        date: date_from || date,
        budget
      });

      // STEP 2: Find locations (DB first, then Google Places)
      // Use interest IDs for location filtering
      const locations = await this.locationService.findLocations({
        timeSlots: dayConcept.timeSlots,
        city,
        interestIds: interest_ids || []
      });

      // STEP 3: Generate content blocks (NEW: using ContentBlocksGenerationService)
      // This generates all 17 blocks in the correct sequence
      const contentBlocks = await this.blocksService.generateFullDayBlocks({
        city,
        audience,
        interests: interests || [],
        concept: dayConcept.concept,
        locations,
        dayConcept
      });

      // STEP 4: Generate meta info (title, subtitle, weather)
      // Use interest names for meta info generation
      const metaInfo = await this.contentService.generateMetaInfo({
        city,
        audience,
        interests: interests || [],
        date: date_from || date,
        concept: dayConcept.concept
      });

      // STEP 5: Extract activities from location blocks for budget calculation
      // (Location blocks contain the main location + alternatives)
      const activities = this.extractActivitiesFromBlocks(contentBlocks, locations);

      // STEP 6: Adjust budget
      const adjustedActivities = this.budgetService.adjustToBudget(activities, budget);

      // STEP 7: Build final itinerary with content blocks
      const itinerary = {
        title: metaInfo.title,
        subtitle: metaInfo.subtitle,
        city,
        date: date_from || date,
        budget,
        conceptual_plan: {
          concept: dayConcept.concept,
          architecture: "content_blocks", // New architecture
          timeSlots: dayConcept.timeSlots
        },
        weather: metaInfo.weather,
        contentBlocks: contentBlocks, // NEW: content blocks instead of activities
        activities: adjustedActivities, // Keep for backward compatibility and budget calculation
        totalCost: this.budgetService.calculateTotal(adjustedActivities),
        withinBudget: this.budgetService.isWithinBudget(adjustedActivities, budget),
        previewOnly: previewOnly
      };

      // STEP 8: Save to storage if needed
      if (previewOnly) {
        try {
          const saved = await this.storageService.savePreview(itinerary);
          if (saved && saved.success && saved.itineraryId) {
            itinerary.itineraryId = saved.itineraryId;
          }
        } catch (saveError) {
          console.error('❌ Error saving preview:', saveError);
          // Continue without saving - itinerary will still be returned
        }
      }

      console.log('✅ ItineraryPipeline: Generation complete');
      return itinerary;

    } catch (error) {
      console.error('❌ ItineraryPipeline: Error', error);
      throw error;
    }
  }

  /**
   * Extract activities from location blocks for budget calculation
   * @param {Array} contentBlocks - Array of content blocks
   * @param {Array} locations - Original locations array
   * @returns {Array} Activities array for budget calculation
   */
  extractActivitiesFromBlocks(contentBlocks, locations) {
    const activities = [];
    
    // Find all location blocks
    const locationBlocks = contentBlocks.filter(block => block.block_type === 'location');
    
    locationBlocks.forEach(block => {
      const mainLocation = block.content?.mainLocation;
      if (mainLocation) {
        // Find corresponding location from original array
        const originalLocation = locations.find(loc => {
          const name = loc.realPlace?.name || loc.name || loc.title;
          return name === mainLocation.name;
        });

        if (originalLocation) {
          activities.push({
            time: originalLocation.time || originalLocation.slot?.time,
            name: mainLocation.name,
            title: mainLocation.name,
            description: mainLocation.description,
            category: originalLocation.category || originalLocation.slot?.category,
            duration: 90,
            price: originalLocation.realPlace?.price || 0,
            location: mainLocation.address,
            photos: originalLocation.realPlace?.photos || [],
            recommendations: mainLocation.recommendation,
            locationId: originalLocation.realPlace?.locationId || null,
            fromGooglePlace: !originalLocation.realPlace?.fromDatabase
          });
        }
      }
    });

    return activities;
  }

  /**
   * Load existing itinerary from storage
   */
  async loadItinerary(itineraryId, isFullPlan = false) {
    return await this.storageService.load(itineraryId, isFullPlan);
  }

  /**
   * Unlock full itinerary after payment
   */
  async unlockItinerary(itineraryId) {
    return await this.storageService.unlock(itineraryId);
  }
}

