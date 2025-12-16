// ItineraryStateService - Manages state transitions between steps
// Ensures consistent state management across preview -> payment -> full plan

export class ItineraryStateService {
  /**
   * Validate state transition
   */
  canTransition(fromState, toState) {
    const validTransitions = {
      'generating': ['preview', 'error'],
      'preview': ['payment', 'error'],
      'payment': ['full', 'error'],
      'full': ['error'],
      'error': ['generating']
    };

    return validTransitions[fromState]?.includes(toState) || false;
  }

  /**
   * Get state from itinerary
   */
  getState(itinerary) {
    if (!itinerary) return 'generating';
    if (itinerary.previewOnly === true) return 'preview';
    if (itinerary.previewOnly === false) return 'full';
    return 'generating';
  }

  /**
   * Validate itinerary state
   */
  validateState(itinerary, expectedState) {
    const currentState = this.getState(itinerary);
    return currentState === expectedState;
  }
}

