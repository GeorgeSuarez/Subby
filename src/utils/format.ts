/**
 * Formatting helpers for currency, dates, and relative time.
 *
 * Skill rule `js-hoist-intl`: Intl formatters are created ONCE at module load,
 * not inside each render. Creating `new Intl.NumberFormat(...)` per call
 * allocates a formatter every render and is wasteful.
 *
 * For v1 we use the device locale. If you need locale overrides later, swap
 * the `undefined` locale arg in a single place here.
 */

import type { CurrencyCode , Cycle } from '@/types/subscription';
import { currencyMeta, cycleMeta } from '@/utils/constants';

// --- Currency ---------------------------------------------------------------

/**
 * Build a single Intl.NumberFormat per (currency, fractionDigits).
 * Memoized so subsequent calls return the same instance.
 */
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(code: CurrencyCode): Intl.NumberFormat {
  const meta = currencyMeta(code);
  const key = `${code}:${meta.fractionDigits}`;
  let fmt = currencyFormatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: meta.fractionDigits,
      maximumFractionDigits: meta.fractionDigits,
    });
    currencyFormatterCache.set(key, fmt);
  }
  return fmt;
}

/** Format a numeric amount as a currency string ("$9.99" / "¥1,200"). */
export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return getCurrencyFormatter(currency).format(amount);
}

/** Compact form for stats — "$412" / "$1.2K" / "$12.4K". */
export function formatCurrencyCompact(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  const meta = currencyMeta(currency);
  if (abs >= 1000) {
    const thousands = amount / 1000;
    const digits = thousands >= 100 ? 0 : 1;
    const symbol = meta.symbol;
    return `${symbol}${thousands.toFixed(digits)}K`;
  }
  return formatCurrency(amount, currency);
}

// --- Dates ------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  timeZone: 'UTC',
});

/** Format an ISO date string as "Jul 16, 2026" (locale-dependent). */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return dateFormatter.format(d);
}

/** Format an ISO date string as "Jul 16". */
export function formatMonthDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return monthDayFormatter.format(d);
}

/** Format an ISO date's weekday as "Wed". */
export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return weekdayFormatter.format(d);
}

// --- Relative time ----------------------------------------------------------

/**
 * Humanized "renews in" string.
 *   days < 0  → "Overdue N days"
 *   days == 0 → "Today"
 *   days == 1 → "Tomorrow"
 *   days < 7  → "In N days"
 *   days < 30 → "In N weeks"
 *   else      → "In Md"
 */
export function formatRenewalIn(days: number): string {
  if (days < 0) return `Overdue ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (remDays === 0) return `In ${months} ${months === 1 ? 'month' : 'months'}`;
  return `In ${months}mo ${remDays}d`;
}

// --- Cycles -----------------------------------------------------------------

/** Display label for a cycle ("Monthly" / "Quarterly" / "Yearly"). */
export function formatCycle(cycle: Cycle): string {
  return cycleMeta(cycle).label;
}

/** "per month" / "per quarter" / "per year" suffix used on amount rows. */
export function cycleSuffix(cycle: Cycle): string {
  switch (cycle) {
    case 'monthly':
      return 'per month';
    case 'quarterly':
      return 'per quarter';
    case 'yearly':
      return 'per year';
  }
}