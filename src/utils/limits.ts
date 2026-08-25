/**
 * Pro gating — which features require an active entitlement.
 *
 * Free users can track up to five subscriptions; Pro unlocks unlimited
 * tracking. Other power features are gated separately.
 * Pure helpers (no RN imports) so fully Jest-testable.
 */

export const PRO_PRODUCT_IDS = [
  'subby_pro_monthly',
  'subby_pro_yearly',
  'subby_pro_lifetime',
] as const;

export type ProProductId = (typeof PRO_PRODUCT_IDS)[number];

/**
 * Product IDs grouped by type for paywall convenience.
 * Yearly is hero (pre-selected, trial), Lifetime is non-consumable.
 */
export const SUBSCRIPTION_PRODUCT_IDS = [
  'subby_pro_monthly',
  'subby_pro_yearly',
] as const;

export const LIFETIME_PRODUCT_ID: ProProductId = 'subby_pro_lifetime';

/** Maximum active subscriptions on the free tier. */
export const FREE_SUB_LIMIT = 5;

export const FREE_SUB_LIMIT_MESSAGE = `Free accounts can track up to ${FREE_SUB_LIMIT} subscriptions. Upgrade to Pro for unlimited tracking.`;

/** Whether a tier can add another active subscription. */
export function canAddSubscription(
  currentCount: number,
  isPro: boolean,
): boolean {
  return isPro || currentCount < FREE_SUB_LIMIT;
}

/**
 * Closed registry: only features whose behaviour actually flips with Pro.
 * Anything unlisted is free by default (see isProFeature) — add a key when
 * the feature ships, not before.
 */
export const PRO_FEATURES = [
  'pieChart',
  'budget',
  'advancedReminders',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

/**
 * True when the feature requires Pro. Every value in PRO_FEATURES returns
 * true; anything else (unknown key) is treated as free so new features don't
 * accidentally get gated.
 */
export function isProFeature(key: string): boolean {
  return PRO_FEATURES.some((f) => f === key);
}

/**
 * Whether a user with `isPro` can use `feature`.
 * Free users can use non-Pro features; Pro users can use everything.
 */
export function canUseFeature(
  feature: ProFeature | string,
  isPro: boolean,
): boolean {
  if (!isProFeature(feature)) return true;
  return isPro;
}
