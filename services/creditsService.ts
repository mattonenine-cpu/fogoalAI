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
   * Проверка: активна ли подписка (безлимит навсегда или не истекла по дате).
   */
  static isSubscriptionActive(credits: CreditsSystem): boolean {
    if (credits.subscriptionType === 'unlimited' || (credits.hasUnlimitedAccess && !credits.subscriptionType)) return true;
    if (credits.subscriptionType && credits.subscriptionExpiresAt) return new Date() < new Date(credits.subscriptionExpiresAt);
    return false;
  }

  /**
   * Apply promo code — вызывается после успешного ответа API /api/promo-redeem.
   * Устанавливает тип подписки и дату окончания (для month/week).
   */
  static applyPromoResult(
    credits: CreditsSystem,
    result: { subscriptionType: 'unlimited' | 'month' | 'week'; subscriptionExpiresAt?: string }
  ): CreditsSystem {
    return {
      ...credits,
      hasUnlimitedAccess: true,
      subscriptionType: result.subscriptionType,
      subscriptionExpiresAt: result.subscriptionExpiresAt,
    };
  }

  /**
   * Apply promo code for unlimited access (legacy, один старый код).
   */
  static applyPromoCode(credits: CreditsSystem, promoCode: string): CreditsSystem {
    if (promoCode === UNLIMITED_PROMO_CODE) {
      return {
        ...credits,
        hasUnlimitedAccess: true,
        promoCode,
        subscriptionType: 'unlimited',
      };
    }
    return credits;
  }

  /**
   * Check if user can afford an action
   */
  static canAfford(credits: CreditsSystem, cost: number): boolean {
    if (!credits) return false;
    if (credits.hasUnlimitedAccess && this.isSubscriptionActive(credits)) return true;
    if (credits.subscriptionType && credits.subscriptionExpiresAt && this.isSubscriptionActive(credits)) return true;
    return credits.availableCredits >= cost;
  }

  /**
   * Deduct credits for an action
   */
  static deductCredits(credits: CreditsSystem, cost: number): CreditsSystem {
    if (credits.hasUnlimitedAccess && this.isSubscriptionActive(credits)) return credits;
    if (credits.subscriptionType && this.isSubscriptionActive(credits)) return credits;

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
    const active = this.isSubscriptionActive(credits);
    return {
      available: credits.availableCredits,
      total: credits.totalCredits,
      used: credits.usedCredits,
      hasUnlimited: credits.hasUnlimitedAccess || active,
      subscriptionType: credits.subscriptionType,
      subscriptionExpiresAt: credits.subscriptionExpiresAt,
      percentage: (credits.hasUnlimitedAccess || active) ? 100 : (credits.availableCredits / credits.totalCredits) * 100
    };
  }

  /**
   * Дата следующей выдачи 1000 кредитов (первый день следующего месяца по lastResetDate).
   */
  static getNextResetDate(credits: CreditsSystem): Date {
    const last = new Date(credits.lastResetDate);
    return new Date(last.getFullYear(), last.getMonth() + 1, 1, 0, 0, 0, 0);
  }

  /**
   * Оставшееся время до следующей выдачи в миллисекундах. Если уже пора — 0.
   */
  static getMsUntilNextReset(credits: CreditsSystem): number {
    const next = this.getNextResetDate(credits);
    const now = new Date();
    return Math.max(0, next.getTime() - now.getTime());
  }
}
