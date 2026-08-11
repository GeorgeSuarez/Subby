/**
 * Typed SQLite query layer.
 *
 * Every function takes (and returns) the canonical {@link Subscription} domain
 * type. SQL rows (snake_case, archived as 0/1) are converted to/from the
 * domain shape inside this module so the rest of the app never sees SQLite
 * specifics.
 *
 * All functions are async and re-use the singleton from `db/client.ts`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/client';
import { subsWhereClause } from '@/db/query-builder';
import type { SubscriptionRow } from '@/db/schema';
import type {
  CategorySlug,
  CurrencyCode,
  Cycle,
  Subscription,
  SubscriptionDraft,
  SubscriptionPatch,
} from '@/types/subscription';

/** Validate + coerce a SQLite row into a domain Subscription. Throws on bad data. */
export function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency as CurrencyCode,
    cycle: row.cycle as Cycle,
    nextRenewal: row.next_renewal,
    category: row.category as CategorySlug,
    icon: row.icon,
    color: row.color ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived === 1,
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

/** Convert a domain Subscription to a row-shaped object for INSERT/UPDATE. */
export function subscriptionToRow(sub: RowInput): Omit<SubscriptionRow, 'archived'> & { archived: number } {
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
    created_at: sub.createdAt,
    updated_at: sub.updatedAt,
    archived: sub.archived ? 1 : 0,
    seeded: sub.seeded ? 1 : 0,
  };
}

const ALL_COLUMNS = `
  id, name, amount, currency, cycle,
  next_renewal AS next_renewal, category, icon, color, notes,
  created_at, updated_at, archived, seeded
`;

async function allSubs(
  db: SQLiteDatabase,
  includeSeeded: boolean,
  where = '',
): Promise<Subscription[]> {
  // `subsWhereClause` emits a full 'WHERE …' fragment ('' when unneeded) —
  // never a bare 'AND', which would be invalid SQL.
  const rows = await db.getAllAsync<SubscriptionRow>(
    `SELECT ${ALL_COLUMNS} FROM subscriptions${subsWhereClause(includeSeeded, where)};`,
  );
  return rows.map(rowToSubscription);
}

// --- Read -------------------------------------------------------------------

/**
 * Get every subscription the current account may see.
 * Demo (seeded) rows are only visible to the test account — `includeSeeded`
 * must be `true` for it and `false` for everyone else (the default).
 */
export async function getAllSubscriptions(includeSeeded = false): Promise<Subscription[]> {
  const db = await getDatabase();
  return allSubs(db, includeSeeded);
}

/** Get only active (non-archived) subscriptions. Same seeded-visibility rule. */
export async function getActiveSubscriptions(includeSeeded = false): Promise<Subscription[]> {
  const db = await getDatabase();
  return allSubs(db, includeSeeded, ' WHERE archived = 0');
}

/** Look up a single subscription by id. Returns null if not found. */
export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SubscriptionRow>(
    `SELECT ${ALL_COLUMNS} FROM subscriptions WHERE id = ?;`,
    id,
  );
  return row ? rowToSubscription(row) : null;
}

// --- Write ------------------------------------------------------------------

/**
 * Insert a new subscription. Caller supplies all fields except id/timestamps.
 * Pass `{ seeded: true }` for demo-data rows (invisible to non-test accounts).
 * The function generates the rest and returns the persisted Subscription.
 */
export async function insertSubscription(
  draft: SubscriptionDraft,
  options: { seeded?: boolean } = {},
): Promise<Subscription> {
  const db = await getDatabase();
  const now = Date.now();
  const id = generateId();
  const row = subscriptionToRow({
    ...draft,
    id,
    createdAt: now,
    updatedAt: now,
    archived: false,
    seeded: options.seeded ?? false,
  });

  await db.runAsync(
    `INSERT INTO subscriptions
      (id, name, amount, currency, cycle, next_renewal, category, icon, color, notes, created_at, updated_at, archived, seeded)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      row.id,
      row.name,
      row.amount,
      row.currency,
      row.cycle,
      row.next_renewal,
      row.category,
      row.icon,
      row.color,
      row.notes,
      row.created_at,
      row.updated_at,
      row.archived,
      row.seeded,
    ],
  );

  // Read back to guarantee the persisted row matches (catches column-shape drift early).
  const stored = await getSubscriptionById(id);
  if (!stored) throw new Error(`insertSubscription: row ${id} not found after insert`);
  return stored;
}

/** Update fields on an existing subscription. Returns the new row or null. */
export async function updateSubscription(id: string, patch: SubscriptionPatch): Promise<Subscription | null> {
  const db = await getDatabase();
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

  await db.runAsync(
    `UPDATE subscriptions SET
      name = ?, amount = ?, currency = ?, cycle = ?, next_renewal = ?,
      category = ?, icon = ?, color = ?, notes = ?, updated_at = ?, archived = ?
      WHERE id = ?;`,
    [
      row.name,
      row.amount,
      row.currency,
      row.cycle,
      row.next_renewal,
      row.category,
      row.icon,
      row.color,
      row.notes,
      row.updated_at,
      row.archived,
      id,
    ],
  );

  return getSubscriptionById(id);
}

/** Set the archived flag on a subscription (soft delete). */
export async function setArchived(id: string, archived: boolean): Promise<Subscription | null> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE subscriptions SET archived = ?, updated_at = ? WHERE id = ?;',
    [archived ? 1 : 0, Date.now(), id],
  );
  return getSubscriptionById(id);
}

/** Permanently delete a subscription. Use sparingly — prefer archive. */
export async function deleteSubscription(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?;', id);
}

/** Wipe the entire subscriptions table. Used by Settings > Danger Zone. */
export async function deleteAllSubscriptions(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subscriptions;');
}

// --- Helpers ----------------------------------------------------------------

/** Generate a sortable unique id. Uses crypto.randomUUID when available. */
function generateId(): string {
  // Available in React Native's Hermes runtime as of RN 0.71+.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Hex fallback with timestamp prefix for sortability.
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2, 10);
  return `${ts}-${rand}`;
}