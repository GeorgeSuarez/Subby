/**
 * App-wide constants: categories, billing cycles, currencies.
 *
 * These are pure data tables (no React / RN imports) so they can be consumed
 * from utils, query helpers, and tests alike.
 */

import type { CategorySlug, CurrencyCode, Cycle } from '@/types/subscription';

export interface CategoryMeta {
  slug: CategorySlug;
  label: string;
  /** Default Ionicons glyph used when the subscription doesn't specify one. */
  icon: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { slug: 'streaming', label: 'Streaming', icon: 'film-outline' },
  { slug: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { slug: 'cloud', label: 'Cloud', icon: 'cloud-outline' },
  { slug: 'productivity', label: 'Productivity', icon: 'briefcase-outline' },
  { slug: 'developer', label: 'Developer', icon: 'code-slash-outline' },
  { slug: 'gaming', label: 'Gaming', icon: 'game-controller-outline' },
  { slug: 'news', label: 'News', icon: 'newspaper-outline' },
  { slug: 'fitness', label: 'Fitness', icon: 'fitness-outline' },
  { slug: 'lifestyle', label: 'Lifestyle', icon: 'sparkles-outline' },
  { slug: 'education', label: 'Education', icon: 'school-outline' },
  { slug: 'utilities', label: 'Utilities', icon: 'construct-outline' },
  { slug: 'other', label: 'Other', icon: 'cube-outline' },
] as const;

/** Quick lookup by slug. */
export const CATEGORY_BY_SLUG: Record<CategorySlug, CategoryMeta> =
  // SAFETY: CATEGORIES above enumerates every CategorySlug (`as const`),
  // so the fromEntries map is total for the union — unknown slugs hit the
  // `?? DEFAULT_CATEGORY` fallback instead of this entry.
  Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<
    CategorySlug,
    CategoryMeta
  >;

/** Fallback when a stored slug is unknown (forward-compatibility). */
export const DEFAULT_CATEGORY: CategoryMeta =
  CATEGORIES[CATEGORIES.length - 1]!;

export function categoryMeta(slug: CategorySlug): CategoryMeta {
  return CATEGORY_BY_SLUG[slug] ?? DEFAULT_CATEGORY;
}

export interface CycleMeta {
  cycle: Cycle;
  label: string;
  /** How many calendar months each cycle spans. */
  months: number;
}

export const CYCLES: readonly CycleMeta[] = [
  { cycle: 'monthly', label: 'Monthly', months: 1 },
  { cycle: 'quarterly', label: 'Quarterly', months: 3 },
  { cycle: 'yearly', label: 'Yearly', months: 12 },
] as const;

export const CYCLE_BY_NAME: Record<Cycle, CycleMeta> =
  // SAFETY: CYCLES enumerates every Cycle (`as const`), so the fromEntries map
  // is total for the union; lookups fall back to monthly for unknown keys.
  Object.fromEntries(CYCLES.map((c) => [c.cycle, c])) as Record<
    Cycle,
    CycleMeta
  >;

export function cycleMeta(cycle: Cycle): CycleMeta {
  return CYCLE_BY_NAME[cycle] ?? CYCLE_BY_NAME.monthly;
}

export interface CurrencyMeta {
  code: CurrencyCode;
  /** Display symbol, used as a fallback when Intl is unavailable. */
  symbol: string;
  /** Number of fractional digits typically shown. 0 for JPY. */
  fractionDigits: number;
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'USD', symbol: '$', fractionDigits: 2 },
  { code: 'EUR', symbol: '€', fractionDigits: 2 },
  { code: 'GBP', symbol: '£', fractionDigits: 2 },
  { code: 'JPY', symbol: '¥', fractionDigits: 0 },
  { code: 'CAD', symbol: 'C$', fractionDigits: 2 },
  { code: 'AUD', symbol: 'A$', fractionDigits: 2 },
] as const;

export const CURRENCY_BY_CODE: Record<CurrencyCode, CurrencyMeta> =
  // SAFETY: CURRENCIES enumerates every CurrencyCode (`as const`), so the
  // fromEntries map is total for the union; lookups fall back to USD.
  Object.fromEntries(CURRENCIES.map((c) => [c.code, c])) as Record<
    CurrencyCode,
    CurrencyMeta
  >;

/** Default currency for a brand-new app (user can change in Settings). */
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/**
 * The only account allowed to load or remove demo (seeded) data.
 * Signing in with this email auto-loads the seed set; the Settings
 * "Demo data" section shows its controls exclusively to this account.
 */
export const TEST_ACCOUNT_EMAIL = 'test@subby.app';

/** Pro demo account — same password, has Pro unlocked via user_entitlements. */
export const PRO_DEMO_EMAIL = 'pro@subby.app';

/**
 * Fixed password for the test account (mock auth has no real backend, so this
 * is a plain constant, not a hashed credential). `validateDraft` enforces it
 * whenever the email matches `TEST_ACCOUNT_EMAIL`.
 */
export const TEST_ACCOUNT_PASSWORD = 'subby123';

/** Rule: is this the test account? Case-insensitive on a trimmed value. */
export function isTestAccountEmail(email: string | null | undefined): boolean {
  if (email == null) return false;
  const normalized = email.trim().toLowerCase();
  return normalized === TEST_ACCOUNT_EMAIL || normalized === PRO_DEMO_EMAIL;
}

export function currencyMeta(code: CurrencyCode): CurrencyMeta {
  return CURRENCY_BY_CODE[code] ?? CURRENCY_BY_CODE.USD;
}

/** All category slugs as a readonly tuple (handy for the Chip row in the form). */
export const CATEGORY_SLUGS: readonly CategorySlug[] = CATEGORIES.map(
  (c) => c.slug,
);
