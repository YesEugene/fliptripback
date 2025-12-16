// ItineraryPipeline - Orchestrates the entire itinerary generation flow
// This is the main entry point that coordinates all steps

import { LocationService } from './LocationService.js';
import { ContentGenerationService } from './ContentGenerationService.js';
import { ItineraryStorageService } from './ItineraryStorageService.js';
import { ItineraryStateService } from './ItineraryStateService.js';
import { BudgetService } from './BudgetService.js';

export class ItineraryPipeline {
  constructor() {
    this.locationService = new LocationService();
    this.contentService = new ContentGenerationService();
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

      // STEP 3: Generate descriptions and recommendations
      // Use interest names for content generation
      const activities = await this.contentService.generateActivitiesContent({
        locations,
        dayConcept,
        interests: interests || [], // Use interest names for content generation
        audience
      });

      // STEP 4: Adjust budget
      const adjustedActivities = this.budgetService.adjustToBudget(activities, budget);

      // STEP 5: Generate meta info (title, subtitle, weather)
      // Use interest names for meta info generation
      const metaInfo = await this.contentService.generateMetaInfo({
        city,
        audience,
        interests: interests || [],
        date: date_from || date,
        concept: dayConcept.concept
      });

      // STEP 6: Build final itinerary
      const itinerary = {
        title: metaInfo.title,
        subtitle: metaInfo.subtitle,
        city,
        date: date_from || date,
        budget,
        conceptual_plan: {
          concept: dayConcept.concept,
          architecture: "clean_modular",
          timeSlots: dayConcept.timeSlots
        },
        weather: metaInfo.weather,
        activities: adjustedActivities,
        totalCost: this.budgetService.calculateTotal(adjustedActivities),
        withinBudget: this.budgetService.isWithinBudget(adjustedActivities, budget),
        previewOnly: previewOnly
      };

      // STEP 7: Save to storage if needed
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

