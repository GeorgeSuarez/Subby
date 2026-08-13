/**
 * Pure subscription filtering + sorting helpers.
 *
 * No React / RN imports so this module is fully testable in plain Node Jest.
 * Skill rule `react-state-minimize`: derived lists are computed during render
 * (or via `useMemo` for memoization), never stored as separate state.
 */

import type {
  Subscription,
  SubscriptionFilter,
  SubscriptionSort,
} from '@/types/subscription';
import {
  monthlyEquivalent,
  nextRenewalAfter,
  parseDate,
} from '@/utils/billing';

export interface FilterSortOptions {
  query: string;
  sort: SubscriptionSort;
  filter: SubscriptionFilter;
}

const QUERY_WORDS_RE = /\s+/g;

/**
 * Case-insensitive, multi-word contains match against name + category + notes.
 * Empty / whitespace-only queries match everything.
 */
export function matchesQuery(sub: Subscription, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return true;

  const haystackParts = [sub.name, sub.category, sub.notes ?? ''].map((s) =>
    s.toLowerCase(),
  );
  const haystack = haystackParts.join(' ');

  // Each whitespace-separated token must appear somewhere in the haystack.
  const tokens = q.split(QUERY_WORDS_RE).filter(Boolean);
  return tokens.every((tok) => haystack.includes(tok));
}

/** Apply the active/archived/all filter only. */
export function applyFilter(
  subs: readonly Subscription[],
  filter: SubscriptionFilter,
): Subscription[] {
  switch (filter) {
    case 'active':
      return subs.filter((s) => !s.archived);
    case 'archived':
      return subs.filter((s) => s.archived);
    case 'all':
    default:
      return subs.slice();
  }
}

/** Sort a shallow-copied list of subscriptions by the requested key. */
export function applySort(
  subs: Subscription[],
  sort: SubscriptionSort,
): Subscription[] {
  const copy = subs.slice();
  switch (sort) {
    case 'name':
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        }),
      );
    case 'amount':
      // Largest monthly equivalent first (most expensive is most useful to see up top).
      return copy.sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
    case 'nextRenewal':
      return copy.sort((a, b) => {
        const aD = parseDate(nextRenewalAfter(a)).getTime();
        const bD = parseDate(nextRenewalAfter(b)).getTime();
        return aD - bD;
      });
    default:
      return copy;
  }
}

/**
 * Combine filter → query-match → sort in one pass. Returns a NEW array
 * (the original input is never mutated).
 */
export function filterAndSortSubs(
  subs: readonly Subscription[],
  opts: FilterSortOptions,
): Subscription[] {
  const filtered = applyFilter(subs, opts.filter).filter((s) =>
    matchesQuery(s, opts.query),
  );
  return applySort(filtered, opts.sort);
}
