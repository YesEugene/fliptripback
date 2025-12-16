// BudgetService - Handles budget calculations and adjustments
// Isolated service for budget-related logic

export class BudgetService {
  /**
   * Adjust activities prices to fit within budget (±30%)
   */
  adjustToBudget(activities, targetBudget) {
    const budgetMin = targetBudget * 0.7;
    const budgetMax = targetBudget * 1.3;

    let totalCost = activities.reduce((sum, act) => sum + act.price, 0);

    if (totalCost < budgetMin || totalCost > budgetMax) {
      const adjustmentFactor = targetBudget / totalCost;
      return activities.map(activity => ({
        ...activity,
        price: Math.round(activity.price * adjustmentFactor),
        priceRange: this.formatPriceRange(activity.category, activity.priceLevel || 2, activity.city || '')
      }));
    }

    return activities.map(activity => ({
      ...activity,
      priceRange: this.formatPriceRange(activity.category, activity.priceLevel || 2, activity.city || '')
    }));
  }

  /**
   * Calculate total cost
   */
  calculateTotal(activities) {
    return activities.reduce((sum, act) => sum + act.price, 0);
  }

  /**
   * Check if within budget
   */
  isWithinBudget(activities, budget) {
    return this.calculateTotal(activities) <= parseInt(budget);
  }

  /**
   * Format price range based on category and price level
   */
  formatPriceRange(category, priceLevel, city = '') {
    const price = priceLevel * 5;
    
    // Simple range formatting
    if (price <= 10) return `${price}€`;
    
    const rangeMin = Math.max(0, price - 5);
    const rangeMax = price + 5;
    return `${rangeMin}-${rangeMax}€`;
  }
}

