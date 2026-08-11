/**
 * Domain types for Subby.
 *
 * These are the canonical shapes that flow between the Zustand store, the
 * SQLite queries, and the UI. SQLite row shapes are defined alongside the
 * queries in `src/db/queries.ts` and mapped to these domain types via
 * `rowToSubscription`.
 */

/** ISO-4217 currency codes we support out of the box. More can be added. */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD';

/** Billing cycle. `months` is how many calendar months each cycle spans. */
export type Cycle = 'monthly' | 'quarterly' | 'yearly';

/** Category slug. Keep stable string ids; labels live in `utils/constants.ts`. */
export type CategorySlug =
  | 'streaming'
  | 'music'
  | 'cloud'
  | 'productivity'
  | 'developer'
  | 'gaming'
  | 'news'
  | 'fitness'
  | 'lifestyle'
  | 'education'
  | 'utilities'
  | 'other';

/** Identifier of the leading icon (Ionicons glyph name). */
export type SubscriptionIcon = string;

/** Canonical subscription object used across the app. */
export interface Subscription {
  id: string;
  name: string;
  /** Amount per cycle, in major currency units (e.g. 9.99 = nine dollars ninety-nine). */
  amount: number;
  currency: CurrencyCode;
  cycle: Cycle;
  /** ISO-8601 date of the next renewal (YYYY-MM-DD). */
  nextRenewal: string;
  /** Category slug. */
  category: CategorySlug;
  /** Ionicons glyph name rendered in the avatar tile. */
  icon: SubscriptionIcon;
  /** Optional brand/client color used to tint the avatar (hex or rgba). */
  color?: string;
  /** Optional notes shown on the detail screen. */
  notes?: string;
  /** Optional free-trial end date (ISO YYYY-MM-DD). */
  trialEnds?: string;
  /**
   * Id of the scheduled renewal-reminder notification, when one exists.
   * Internal bookkeeping — used to cancel/reschedule on edits.
   */
  notificationId?: string;
  /** Epoch ms when this subscription was created in the app. */
  createdAt: number;
  /** Epoch ms when last edited; equals createdAt for never-edited rows. */
  updatedAt: number;
  /** Archived rows are excluded from totals and lists but kept for history. */
  archived: boolean;
}

/**
 * Shape used by the add/edit form (no id/timestamps; server assigns those).
 * `amount` is the RAW user input (e.g. "9.99", "12", "9.") — converting it to
 * a number mid-typing would strip the decimal point before it's entered. It is
 * coerced to a number at the DB boundary (see `subscriptionToRow`).
 */
export type SubscriptionDraft = Omit<
  Subscription,
  'id' | 'createdAt' | 'updatedAt' | 'archived' | 'amount'
> & {
  amount: string;
};

/** Partial draft for edits — only fields the user is changing. */
export type SubscriptionPatch = Partial<SubscriptionDraft>;

/** Sort options for the subscriptions list. */
export type SubscriptionSort = 'name' | 'amount' | 'nextRenewal';

/** Filter applied on top of sort; defaults to 'active' (not archived). */
export type SubscriptionFilter = 'active' | 'archived' | 'all';