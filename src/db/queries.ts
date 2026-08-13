/**
 * Typed Supabase query layer for subscriptions.
 *
 * Every function takes (and returns) the canonical {@link Subscription} domain
 * type. Supabase rows (snake_case, boolean flags) are converted to/from the
 * domain shape inside this module so the rest of the app never sees
 * PostgREST specifics.
 *
 * Ownership: the `user_id` column defaults to `auth.uid()` and RLS scopes
 * every row to the signed-in user, so queries never filter by user id.
 * Renewal-reminder notification ids are device-local (`notification-sidecar`)
 * and merged onto reads here.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  CategorySlug,
  CurrencyCode,
  Cycle,
  Subscription,
  SubscriptionDraft,
  SubscriptionPatch,
} from '@/types/subscription';
import {
  clearAllNotificationIds,
  deleteNotificationId,
  getAllNotificationIds,
  setNotificationId as sidecarSetNotificationId,
} from '@/db/notification-sidecar';

/** PostgREST row shape for the `subscriptions` table (RLS-scoped to the user). */
interface SubscriptionRowRemote {
  id: string;
  user_id: string;
  name: string;
  amount: string | number;
  currency: string;
  cycle: string;
  next_renewal: string;
  category: string;
  icon: string;
  color: string | null;
  notes: string | null;
  trial_ends: string | null;
  created_at: number | string;
  updated_at: number | string;
  archived: boolean;
  seeded: boolean;
}

/** Coerce a PostgREST row into a domain Subscription. Numeric values arrive as
 * strings (numeric/bigint JSON) — coerced with Number(). */
function rowToSubscription(row: SubscriptionRowRemote): Subscription {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency as CurrencyCode,
    cycle: row.cycle as Cycle,
    nextRenewal: row.next_renewal,
    category: row.category as CategorySlug,
    icon: row.icon,
    color: row.color ?? undefined,
    notes: row.notes ?? undefined,
    trialEnds: row.trial_ends ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    archived: row.archived,
  };
}

/** Input shape for `subscriptionToRow` — amount may be raw form text or a number. */
type RowInput = Omit<SubscriptionDraft, 'amount'> & {
  amount: number | string;
  id: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  seeded?: boolean;
};

/** Convert a domain Subscription to a PostgREST insert/update payload. */
function subscriptionToRow(
  sub: RowInput,
): Omit<SubscriptionRowRemote, 'user_id'> {
  return {
    id: sub.id,
    name: sub.name,
    amount: Number(sub.amount),
    currency: sub.currency,
    cycle: sub.cycle,
    next_renewal: sub.nextRenewal,
    category: sub.category,
    icon: sub.icon,
    color: sub.color ?? null,
    notes: sub.notes ?? null,
    trial_ends: sub.trialEnds ?? null,
    created_at: sub.createdAt,
    updated_at: sub.updatedAt,
    archived: sub.archived,
    seeded: sub.seeded ?? false,
  };
}

/** A `select *` query on the subscriptions table (RLS-scoped to the user). */
function subscriptionsQuery() {
  return supabase.from('subscriptions').select('*');
}

/** Merge device-local notification ids onto remote rows. */
async function withNotificationIds(
  subs: Subscription[],
): Promise<Subscription[]> {
  if (subs.length === 0) return subs;
  const map = await getAllNotificationIds();
  return subs.map((s) => ({ ...s, notificationId: map[s.id] ?? undefined }));
}

function isMissingRowError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

// --- Read -------------------------------------------------------------------

/**
 * Get every subscription the current account may see.
 * Demo (seeded) rows are only loaded for the test account — `includeSeeded`
 * must be `true` for it and `false` for everyone else (the default).
 */
export async function getAllSubscriptions(
  includeSeeded = false,
): Promise<Subscription[]> {
  if (!isSupabaseConfigured) return [];
  let query = subscriptionsQuery();
  if (!includeSeeded) query = query.eq('seeded', false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return withNotificationIds((data ?? []).map(rowToSubscription));
}

/** Look up a single subscription by id. Returns null if not found. */
export async function getSubscriptionById(
  id: string,
): Promise<Subscription | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await subscriptionsQuery().eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const sub = rowToSubscription(data);
  const [merged] = await withNotificationIds([sub]);
  return merged ?? null;
}

// --- Write ------------------------------------------------------------------

/**
 * Insert a new subscription. Caller supplies all fields except id/timestamps.
 * Pass `{ seeded: true }` for demo-data rows (test account only).
 * The function generates the rest and returns the persisted Subscription.
 */
export async function insertSubscription(
  draft: SubscriptionDraft,
  options: { seeded?: boolean } = {},
): Promise<Subscription> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const now = Date.now();
  const row = subscriptionToRow({
    ...draft,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    archived: false,
    seeded: options.seeded ?? false,
  });
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToSubscription(data);
}

/** Update fields on an existing subscription. Returns the new row or null. */
export async function updateSubscription(
  id: string,
  patch: SubscriptionPatch,
): Promise<Subscription | null> {
  if (!isSupabaseConfigured) return null;
  const existing = await getSubscriptionById(id);
  if (!existing) return null;

  const merged: Subscription = {
    ...existing,
    ...patch,
    // Patch amount arrives as raw form text — coerce back to a number.
    amount: Number(patch.amount ?? existing.amount),
    updatedAt: Date.now(),
  };
  const row = subscriptionToRow(merged);

  const { data, error } = await supabase
    .from('subscriptions')
    .update(row)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error && !isMissingRowError(error)) throw new Error(error.message);
  if (!data) return null;
  return rowToSubscription(data);
}

/** Set the archived flag on a subscription (soft delete). */
export async function setArchived(
  id: string,
  archived: boolean,
): Promise<Subscription | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ archived, updated_at: Date.now() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error && !isMissingRowError(error)) throw new Error(error.message);
  if (!data) return null;
  const sub = rowToSubscription(data);
  const [merged] = await withNotificationIds([sub]);
  return merged ?? null;
}

/**
 * Set (or clear) the scheduled renewal-reminder notification id for a
 * subscription. Device-local sidecar — never sent to Supabase.
 */
export async function setNotificationId(
  id: string,
  notificationId: string | null,
): Promise<void> {
  if (notificationId) {
    await sidecarSetNotificationId(id, notificationId);
  } else {
    await deleteNotificationId(id);
  }
}

/** Permanently delete a subscription. Use sparingly — prefer archive. */
export async function deleteSubscription(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('subscriptions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await deleteNotificationId(id);
}

/** Wipe every subscription the user owns (Settings > Danger Zone). */
export async function deleteAllSubscriptions(): Promise<void> {
  if (!isSupabaseConfigured) return;
  // PostgREST refuses a bare DELETE — the match-all filter is a no-op
  // (created_at >= 0) and RLS still scopes the delete to the user's rows.
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .gte('created_at', 0);
  if (error) throw new Error(error.message);
  await clearAllNotificationIds();
}

// --- Helpers ----------------------------------------------------------------

/** Generate a UUID v4. Uses crypto.randomUUID when available. */
function generateId(): string {
  // Hermes has no WebCrypto, so this is usually undefined on device — the
  // fallback below must produce a valid UUID (the DB column is `uuid`).
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
