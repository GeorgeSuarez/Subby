/**
 * Dashboard insight strip — pure, dependency-free insight selection.
 *
 * Each rule is its own builder (unit-testable in isolation); `pickInsight`
 * returns the first applicable one in priority order. No timers, no state:
 * the strip is fully deterministic for a given set of subscriptions.
 *
 * Skill rules:
 *  - `react-state-minimize`: everything is derived during render.
 *  - No React / RN imports so this module is fully Jest-testable in Node.
 */

import {
  activeCount,
  activeTrials,
  categoryBreakdown,
  largestMonthly,
  monthlyEquivalent,
  monthlyForecast,
  totalMonthlySpend,
  totalYearlySpend,
  yearlySavingsHint,
} from '@/utils/billing';
import { formatCurrency, formatMonthShort } from '@/utils/format';
import type { CurrencyCode, Subscription } from '@/types/subscription';

/** Identifies the strip's icon + tint (mapped in the component). */
export type InsightKind =
  | 'trial'
  | 'savings'
  | 'biggest'
  | 'category'
  | 'peak'
  | 'currency';

export interface Insight {
  kind: InsightKind;
  text: string;
}

/**
 * Pick the first applicable insight. Order encodes importance: urgent
 * (trial) and actionable (savings) outrank informational ones.
 */
export function pickInsight(
  subs: readonly Subscription[],
  currency: CurrencyCode,
): Insight | null {
  return pickInsightExcept(subs, currency, null);
}

/**
 * Pick the first applicable insight whose kind isn't `except`. The dashboard
 * passes the hero's topic (e.g. `'trial'` when the hero names a trial) so
 * the strip never repeats what the hero already says.
 */
export function pickInsightExcept(
  subs: readonly Subscription[],
  currency: CurrencyCode,
  except: InsightKind | null,
): Insight | null {
  const builders: Array<() => Insight | null> = [
    () => trialInsight(subs),
    () => savingsInsight(subs, currency),
    () => biggestInsight(subs, currency),
    () => categoryInsight(subs),
    () => peakMonthInsight(subs, currency),
    () => currencyInsight(subs),
  ];
  for (const build of builders) {
    const insight = build();
    if (insight && insight.kind !== except) return insight;
  }
  return null;
}

/** A free trial ending within 3 days. */
export function trialInsight(subs: readonly Subscription[]): Insight | null {
  const soon = activeTrials(subs).find((t) => t.days <= 3);
  if (!soon) return null;
  return {
    kind: 'trial',
    text: `${soon.name} free trial ${soon.label.toLowerCase()}`,
  };
}

/**
 * The estimated yearly-plan discount, when it's at least 5% of annual spend
 * (so the advice is worth acting on).
 */
export function savingsInsight(
  subs: readonly Subscription[],
  currency: CurrencyCode,
): Insight | null {
  let savingsPerYear = 0;
  for (const s of subs) {
    if (s.archived) continue;
    const hint = yearlySavingsHint(s);
    if (hint) savingsPerYear += hint.savingsPerYear;
  }
  const annual = totalYearlySpend(subs);
  if (savingsPerYear <= 0 || annual <= 0) return null;
  if (savingsPerYear < annual * 0.05) return null;
  return {
    kind: 'savings',
    text: `Billed yearly, you'd save ~${formatCurrency(savingsPerYear, currency)}/yr`,
  };
}

/** The single biggest subscription — only interesting with 2+ active. */
export function biggestInsight(
  subs: readonly Subscription[],
  currency: CurrencyCode,
): Insight | null {
  const biggest = largestMonthly(subs);
  if (!biggest || activeCount(subs) < 2) return null;
  return {
    kind: 'biggest',
    text: `${biggest.name} is your biggest at ${formatCurrency(monthlyEquivalent(biggest), currency)}/mo`,
  };
}

/** One category dominating at least half of spend, across 2+ subs. */
export function categoryInsight(subs: readonly Subscription[]): Insight | null {
  const top = categoryBreakdown(subs)[0];
  if (!top || activeCount(subs) < 2 || top.share < 0.5) return null;
  const pct = Math.round(top.share * 100);
  return {
    kind: 'category',
    text: `${top.label} is ${pct}% of your spend (${top.count} sub${top.count === 1 ? '' : 's'})`,
  };
}

/** A spike month (e.g. a yearly renewal) in the 12-month forecast. */
export function peakMonthInsight(
  subs: readonly Subscription[],
  currency: CurrencyCode,
): Insight | null {
  const steady = totalMonthlySpend(subs);
  let peak: { month: string; total: number } | null = null;
  // Skip the current month (already covered by the hero) — look for spikes.
  for (const month of monthlyForecast(subs, 12).slice(1)) {
    if (month.total > steady && (!peak || month.total > peak.total)) {
      peak = month;
    }
  }
  if (!peak) return null;
  return {
    kind: 'peak',
    text: `${formatMonthShort(peak.month)} is your biggest month: ${formatCurrency(peak.total, currency)} in renewals`,
  };
}

/** Multiple currencies in use — an easy cleanup signal. */
export function currencyInsight(subs: readonly Subscription[]): Insight | null {
  const currencies = new Set(
    subs.filter((s) => !s.archived).map((s) => s.currency),
  );
  if (currencies.size <= 1) return null;
  return {
    kind: 'currency',
    text: `You track ${currencies.size} currencies — consider consolidating`,
  };
}
