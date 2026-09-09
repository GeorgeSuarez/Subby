/**
 * Pure subscription filtering + sorting helpers.
 *
 * No React / RN imports so this module is fully testable in plain Node Jest.
 * Skill rule `react-state-minimize`: derived lists are computed during render
 * (or via `useMemo` for memoization), never stored as separate state.
 */

import type {
  CategorySlug,
  Subscription,
  SubscriptionFilter,
  SubscriptionSort,
} from '@/types/subscription';
import {
  monthlyEquivalent,
  nextRenewalAfter,
  parseDate,
} from '@/utils/billing';
import { CATEGORIES, categoryMeta } from '@/utils/constants';

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

// --- Category grouping -------------------------------------------------------

/** One category bucket of an already filtered + sorted list. */
export interface CategorySection {
  category: CategorySlug;
  label: string;
  icon: string;
  items: Subscription[];
}

/** Canonical category order (CATEGORIES table); unknown slugs sort last. */
const CATEGORY_ORDER = new Map<CategorySlug, number>(
  CATEGORIES.map((c, i) => [c.slug, i]),
);

/**
 * Group an already filtered + sorted list by category.
 * Item order within each group is preserved (so the caller's sort holds
 * per-group); groups follow the canonical CATEGORIES order. Returns a NEW
 * array; empty categories are omitted.
 */
export function groupSubsByCategory(
  subs: readonly Subscription[],
): CategorySection[] {
  const buckets = new Map<CategorySlug, Subscription[]>();
  for (const sub of subs) {
    const list = buckets.get(sub.category);
    if (list) {
      list.push(sub);
    } else {
      buckets.set(sub.category, [sub]);
    }
  }
  const sections: CategorySection[] = [];
  for (const [category, items] of buckets) {
    const meta = categoryMeta(category);
    sections.push({ category, label: meta.label, icon: meta.icon, items });
  }
  sections.sort((a, b) => {
    const orderA = CATEGORY_ORDER.get(a.category) ?? Number.MAX_SAFE_INTEGER;
    const orderB = CATEGORY_ORDER.get(b.category) ?? Number.MAX_SAFE_INTEGER;
    return orderA !== orderB
      ? orderA - orderB
      : a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
  return sections;
}

/** Flattened FlashList item: sticky category header or subscription row. */
export type SubscriptionsListItem =
  | {
      kind: 'header';
      category: CategorySlug;
      label: string;
      icon: string;
      count: number;
      collapsed: boolean;
    }
  | { kind: 'row'; subscription: Subscription };

/**
 * Flatten sections into a heterogeneous FlashList array. Collapsed sections
 * emit only their header. Headers carry only primitives so rows stay
 * `memo()`-effective.
 */
export function flattenSectionsForList(
  sections: readonly CategorySection[],
  collapsed: ReadonlySet<CategorySlug>,
): SubscriptionsListItem[] {
  const flat: SubscriptionsListItem[] = [];
  for (const section of sections) {
    const isCollapsed = collapsed.has(section.category);
    flat.push({
      kind: 'header',
      category: section.category,
      label: section.label,
      icon: section.icon,
      count: section.items.length,
      collapsed: isCollapsed,
    });
    if (!isCollapsed) {
      for (const subscription of section.items) {
        flat.push({ kind: 'row', subscription });
      }
    }
  }
  return flat;
}
