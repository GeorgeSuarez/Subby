/**
 * Pure form helpers for the add/edit subscription modal.
 *
 * No React / RN imports so this module is fully testable in plain Node Jest.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: validation is a pure function of the draft; never
 *    stored as separate state. Errors are derived per render.
 *  - `react-state-fallback`: `defaultDraft` returns the user-intent defaults
 *    (currency from prefs; cycle: monthly; nextRenewal: today+1 month) so an
 *    'undefined' draft can be initialized once and then updated through user
 *    intent only.
 */

import {
  CATEGORIES,
  CURRENCIES,
  CYCLE_BY_NAME,
  categoryMeta,
  cycleMeta,
  currencyMeta,
} from '@/utils/constants';
import { toISODate, todayUTC, addMonths, parseDate } from '@/utils/billing';
import type {
  CategorySlug,
  CurrencyCode,
  Cycle,
  Subscription,
  SubscriptionDraft,
} from '@/types/subscription';

/** Lenient ISO YYYY-MM-DD parser (strict; returns null on malformed inputs). */
export function parseISO(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Use UTC noon to dodge DST edges.
  const date = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export type FieldKey =
  | 'name' | 'amount' | 'currency' | 'cycle' | 'nextRenewal'
  | 'category' | 'icon' | 'color' | 'notes';

export interface FieldError {
  field: FieldKey;
  message: string;
}

/**
 * Validate a draft form. Returns an array of errors (empty when valid).
 * Errors are computed (not stored) — caller decides when to surface them.
 *
 * Skill rule `react-state-minimize`: this is called each render with the
 * latest draft; we don't cache results in state.
 */
export function validateDraft(draft: Partial<SubscriptionDraft>): FieldError[] {
  const errors: FieldError[] = [];

  // name
  const name = (draft.name ?? '').trim();
  if (name.length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (name.length > 64) {
    errors.push({ field: 'name', message: 'Name must be 64 characters or fewer' });
  }

  // amount
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be greater than 0' });
  } else if (amount > 1_000_000) {
    errors.push({ field: 'amount', message: 'Amount seems too high' });
  }

  // currency
  const currency = draft.currency as CurrencyCode | undefined;
  if (!currency || !CURRENCIES.find((c) => c.code === currency)) {
    errors.push({ field: 'currency', message: 'Pick a currency' });
  }

  // cycle
  const cycle = draft.cycle as Cycle | undefined;
  if (!cycle || !CYCLE_BY_NAME[cycle]) {
    errors.push({ field: 'cycle', message: 'Pick a cycle' });
  }

  // nextRenewal
  if (!parseISO(draft.nextRenewal)) {
    errors.push({ field: 'nextRenewal', message: 'Renewal date must be YYYY-MM-DD' });
  }

  // category
  const category = draft.category as CategorySlug | undefined;
  if (!category || !CATEGORIES.find((c) => c.slug === category)) {
    errors.push({ field: 'category', message: 'Pick a category' });
  }

  // icon (defaults to category icon in the screen, but verify if explicitly given)
  if (typeof draft.icon === 'string' && draft.icon.length === 0) {
    errors.push({ field: 'icon', message: 'Pick an icon' });
  }

  // color (optional; only validate format when given)
  const color = draft.color;
  if (typeof color === 'string' && color.length > 0) {
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
      && !/^rgba?\([^)]+\)$/.test(color)) {
      errors.push({ field: 'color', message: 'Color must be a #hex or rgba()' });
    }
  }

  // notes (length-cap; no required check)
  if (typeof draft.notes === 'string' && draft.notes.length > 280) {
    errors.push({ field: 'notes', message: 'Notes are limited to 280 characters' });
  }

  return errors;
}

/** Convert a validation error array into a quick lookup map for renderers. */
export function errorsByField(errors: readonly FieldError[]): Partial<Record<FieldKey, string>> {
  const map: Partial<Record<FieldKey, string>> = {};
  for (const e of errors) {
    if (!map[e.field]) map[e.field] = e.message;
  }
  return map;
}

/**
 * Build the default draft. `currency` comes from the user's persisted prefs;
 * `cycle` defaults to monthly; `nextRenewal` defaults to today + 1 month.
 * Skill `react-state-fallback`: this is the initial user-intent scaffolding;
 * once the user edits a field, that overrides.
 */
export function defaultDraft(currency: CurrencyCode): SubscriptionDraft {
  const now = todayUTC();
  return {
    name: '',
    amount: 0,
    currency,
    cycle: 'monthly',
    nextRenewal: toISODate(addMonths(now, 1)),
    category: 'other',
    icon: categoryMeta('other').icon,
    color: undefined,
    notes: undefined,
  };
}

/**
 * Build a draft from an existing subscription (the Edit flow).
 * Returns a fresh object so mutating it doesn't touch the store.
 */
export function draftFromSubscription(sub: Subscription): SubscriptionDraft {
  return {
    name: sub.name,
    amount: sub.amount,
    currency: sub.currency,
    cycle: sub.cycle,
    nextRenewal: sub.nextRenewal,
    category: sub.category,
    icon: sub.icon,
    color: sub.color,
    notes: sub.notes,
  };
}

/** Parse an ISO date as a Date safely (out of the helper the screen uses). */
export function safeParseISODate(s: string): Date {
  return parseDate(s);
}

/** Lookup helpers exposed for screen consumption. */
export { categoryMeta, currencyMeta, cycleMeta };