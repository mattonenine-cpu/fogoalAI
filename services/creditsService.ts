import { CreditsSystem, UserProfile } from '../types';

export interface CreditCost {
  chatMessage: number;
  workoutGeneration: number;
  examCompletion: number;
  smartPlanner: number;
  ecosystemAnalysis: number;
}

// Base costs that scale with complexity
export const BASE_CREDIT_COSTS: CreditCost = {
  chatMessage: 5,        // Base cost per AI message
  workoutGeneration: 100,  // Cost per workout generation
  examCompletion: 300,   // Cost per full exam completion
  smartPlanner: 50,      // Cost per smart planner request
  ecosystemAnalysis: 200   // Cost for ecosystem analysis
};

// Monthly credit allowance (1000 credits as requested)
export const MONTHLY_CREDIT_ALLOWANCE = 1000;

// Promo code for unlimited access
export const UNLIMITED_PROMO_CODE = 'vza2CxfHlAYeOf';

export class CreditsService {
  /**
   * Initialize credits for new user
   */
  static initializeCredits(): CreditsSystem {
    const now = new Date().toISOString();
    return {
      totalCredits: MONTHLY_CREDIT_ALLOWANCE,
      availableCredits: MONTHLY_CREDIT_ALLOWANCE,
      usedCredits: 0,
      lastResetDate: now,
      hasUnlimitedAccess: false
    };
  }

  /**
   * Check if credits need monthly reset (first day of month)
   */
  static needsMonthlyReset(credits: CreditsSystem): boolean {
    const lastReset = new Date(credits.lastResetDate);
    const now = new Date();
    
    // Reset on first day of month if last reset was in previous month
    return now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
  }

  /**
   * Perform monthly credit reset
   */
  static resetCredits(credits: CreditsSystem): CreditsSystem {
    const now = new Date().toISOString();
    return {
      ...credits,
      totalCredits: MONTHLY_CREDIT_ALLOWANCE,
      availableCredits: MONTHLY_CREDIT_ALLOWANCE,
      usedCredits: 0,
      lastResetDate: now
    };
  }

  /**
   * Apply promo code for unlimited access
   */
  static applyPromoCode(credits: CreditsSystem, promoCode: string): CreditsSystem {
    if (promoCode === UNLIMITED_PROMO_CODE) {
      return {
        ...credits,
        hasUnlimitedAccess: true,
        promoCode
      };
    }
    return credits;
  }

  /**
   * Check if user can afford an action
   */
  static canAfford(credits: CreditsSystem, cost: number): boolean {
    return credits.hasUnlimitedAccess || credits.availableCredits >= cost;
  }

  /**
   * Deduct credits for an action
   */
  static deductCredits(credits: CreditsSystem, cost: number): CreditsSystem {
    if (credits.hasUnlimitedAccess) {
      return credits; // No deduction for unlimited users
    }

    const newAvailable = Math.max(0, credits.availableCredits - cost);
    const newUsed = credits.usedCredits + cost;

    return {
      ...credits,
      availableCredits: newAvailable,
      usedCredits: newUsed
    };
  }

  /**
   * Calculate cost based on AI detail level
   */
  static calculateCost(baseCost: number, detailLevel: 'low' | 'medium' | 'high'): number {
    const multipliers = {
      low: 0.5,
      medium: 1.0,
      high: 1.5
    };
    return Math.round(baseCost * multipliers[detailLevel]);
  }

  /**
   * Get cost for specific action with detail level consideration
   */
  static getActionCost(
    action: keyof CreditCost, 
    detailLevel: 'low' | 'medium' | 'high' = 'medium'
  ): number {
    return this.calculateCost(BASE_CREDIT_COSTS[action], detailLevel);
  }

  /**
   * Update credits in user profile
   */
  static updateProfileCredits(profile: UserProfile, updatedCredits: CreditsSystem): UserProfile {
    return {
      ...profile,
      credits: updatedCredits
    };
  }

  /**
   * Get credits status for UI display
   */
  static getCreditsStatus(credits: CreditsSystem) {
    return {
      available: credits.availableCredits,
      total: credits.totalCredits,
      used: credits.usedCredits,
      hasUnlimited: credits.hasUnlimitedAccess,
      percentage: credits.hasUnlimitedAccess ? 100 : (credits.availableCredits / credits.totalCredits) * 100
    };
  }
}
