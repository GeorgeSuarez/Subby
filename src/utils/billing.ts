/**
 * Billing cycle math — pure functions only.
 *
 * No React / React Native imports so this is fully testable in Node Jest.
 * Skill rule `react-state-minimize`: never cache these results in state —
 * call them during render to derive values.
 */

import type { CategorySlug, Cycle, Subscription } from '@/types/subscription';
import { categoryMeta, cycleMeta } from '@/utils/constants';

/** Parsed YYYY-MM-DD with explicit UTC interpretation (avoids TZ surprises). */
export function parseDate(iso: string): Date {
  // Treated as UTC noon so local timezone shifts don't flip the day.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid ISO date: '${iso}' (expected YYYY-MM-DD)`);
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Format a Date back to YYYY-MM-DD in UTC. */
export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date in UTC, at noon. */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
}

/** Days between two dates, floored. Negative if `to` is before `from`. */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Add N calendar months to a date, clamping the day to the last day of the
 * target month (e.g. Jan 31 + 1 month → Feb 28). Hole-free month arithmetic.
 */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getTime());
  const originalDay = target.getUTCDate();
  target.setUTCMonth(target.getUTCMonth() + months);
  // If the month rolled over (e.g. Jan 31 → Mar 3), clamp back to last day of intended month.
  if (target.getUTCDate() < originalDay) {
    target.setUTCDate(0); // Sets to last day of previous month.
  }
  return target;
}

/**
 * Compute a subscription's next renewal date from its current `nextRenewal`.
 * Skill rule `state-ground-truth`: `nextRenewal` is the source of truth; we
 * advance it by the cycle length. If the stored date is already in the past,
 * we walk forward until we get a future date.
 */
export function nextRenewalAfter(sub: { nextRenewal: string; cycle: Cycle }, from: Date = todayUTC()): string {
  const spanMonths = cycleMeta(sub.cycle).months;
  let current = parseDate(sub.nextRenewal);
  // Advance until renewal is strictly in the future relative to `from`.
  // Sanity cap at 120 iterations to avoid an infinite loop on bad data.
  let guard = 0;
  while (current.getTime() <= from.getTime() && guard < 120) {
    current = addMonths(current, spanMonths);
    guard += 1;
  }
  return toISODate(current);
}

/** Days until the subscription's next renewal, relative to today (UTC). */
export function daysUntilRenewal(sub: { nextRenewal: string; cycle: Cycle }): number {
  const next = parseDate(nextRenewalAfter(sub));
  return daysBetween(todayUTC(), next);
}

/**
 * Convert any cycle's amount to its monthly equivalent.
 * Yearly amounts are divided by 12; quarterly by 3; monthly as-is.
 * Skill rule `react-state-minimize`: derive during render, don't store.
 */
export function monthlyEquivalent(sub: { amount: number; cycle: Cycle }): number {
  const months = cycleMeta(sub.cycle).months;
  return sub.amount / months;
}

/** Convert any cycle's amount to its yearly equivalent. */
export function yearlyEquivalent(sub: { amount: number; cycle: Cycle }): number {
  const months = cycleMeta(sub.cycle).months;
  return (sub.amount / months) * 12;
}

/** Total monthly spend across active subscriptions. */
export function totalMonthlySpend(subs: readonly Subscription[]): number {
  return subs.reduce((sum, s) => (s.archived ? sum : sum + monthlyEquivalent(s)), 0);
}

/** Total yearly spend across active subscriptions. */
export function totalYearlySpend(subs: readonly Subscription[]): number {
  return subs.reduce((sum, s) => (s.archived ? sum : sum + yearlyEquivalent(s)), 0);
}

/** Active subscription count. */
export function activeCount(subs: readonly Subscription[]): number {
  return subs.reduce((n, s) => (s.archived ? n : n + 1), 0);
}

/** Highest monthly equivalent among active subs. Returns 0 if none. */
export function largestMonthly(subs: readonly Subscription[]): Subscription | null {
  let best: Subscription | null = null;
  let bestMonthly = -Infinity;
  for (const s of subs) {
    if (s.archived) continue;
    const m = monthlyEquivalent(s);
    if (m > bestMonthly) {
      best = s;
      bestMonthly = m;
    }
  }
  return best;
}

/**
 * Subset of subscriptions with a renewal within the next `days` days.
 * Skill rule `react-state-minimize`: derive, never store as separate state.
 * Already-renewed-today subs (daysUntil === 0) are included.
 */
export function renewalsWithin(
  subs: readonly Subscription[],
  days: number,
  from: Date = todayUTC(),
): Subscription[] {
  return subs
    .filter((s) => !s.archived)
    .filter((s) => {
      const next = parseDate(nextRenewalAfter(s, from));
      const d = daysBetween(from, next);
      return d >= 0 && d <= days;
    })
    .sort((a, b) => daysBetween(from, parseDate(nextRenewalAfter(a, from))) - daysBetween(from, parseDate(nextRenewalAfter(b, from))));
}

/** Bucket of active subs grouped by category slug. */
export function groupByCategory(subs: readonly Subscription[]): Map<string, Subscription[]> {
  const m = new Map<string, Subscription[]>();
  for (const s of subs) {
    if (s.archived) continue;
    const list = m.get(s.category) ?? [];
    list.push(s);
    m.set(s.category, list);
  }
  return m;
}

// --- Dashboard aggregates ----------------------------------------------------

/** Charges due between `from` and the end of its calendar month. */
export interface MonthCharges {
  /** Sum of actual charge amounts (each sub's real amount, not monthly-eq). */
  total: number;
  /** Number of renewals in the window. */
  count: number;
}

/**
 * Charges coming due from today through the end of the current calendar month.
 * Past renewals roll to next month by construction (see `nextRenewalAfter`),
 * so this window is unambiguous.
 */
export function renewalsThisMonth(
  subs: readonly Subscription[],
  from: Date = todayUTC(),
): MonthCharges {
  // Day 0 of next month (UTC noon) = last day of the current month.
  const endOfMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 12, 0, 0, 0));
  const days = daysBetween(from, endOfMonth);
  const renewals = renewalsWithin(subs, days, from);
  return {
    total: renewals.reduce((sum, s) => sum + s.amount, 0),
    count: renewals.length,
  };
}

/** One row of the category breakdown card. */
export interface CategoryBreakdownItem {
  category: CategorySlug;
  label: string;
  count: number;
  /** Monthly-equivalent spend for this category. */
  monthlyTotal: number;
  /** Share of the grand total (0..1). */
  share: number;
}

/**
 * Monthly spend per category, sorted by amount (largest first). Archived subs
 * are excluded (inherited from `groupByCategory`).
 */
export function categoryBreakdown(subs: readonly Subscription[]): CategoryBreakdownItem[] {
  const grand = totalMonthlySpend(subs);
  const items: CategoryBreakdownItem[] = [];
  for (const [slug, list] of groupByCategory(subs)) {
    const category = slug as CategorySlug;
    const monthlyTotal = list.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
    items.push({
      category,
      label: categoryMeta(category).label,
      count: list.length,
      monthlyTotal,
      share: grand > 0 ? monthlyTotal / grand : 0,
    });
  }
  return items.sort((a, b) => b.monthlyTotal - a.monthlyTotal);
}

/** Progress of monthly spend against a budget. */
export interface BudgetProgress {
  /** 0..1, clamped. */
  pct: number;
  /** True when spent exceeds the budget. */
  over: boolean;
  /** How much spent exceeds the budget (0 when not over). */
  overAmount: number;
}

/** Budget is unset (<= 0) → neutral progress. */
export function budgetProgress(spent: number, budget: number): BudgetProgress {
  if (!Number.isFinite(budget) || budget <= 0) {
    return { pct: 0, over: false, overAmount: 0 };
  }
  const pct = Math.min(1, Math.max(0, spent / budget));
  const over = spent > budget;
  return { pct, over, overAmount: over ? spent - budget : 0 };
}