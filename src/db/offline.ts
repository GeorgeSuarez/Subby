/**
 * Sync coordinator: per-user read cache, FIFO write queue, and the single
 * mutation pipeline.
 *
 * Every subscription/prefs mutation funnels through `applyMutation`, which
 * owns the whole pipeline: reachability check → direct write or enqueue →
 * notification side-effects → cache write → re-read → error classification.
 * `flushPendingOps` replays the queue through the SAME per-type execution,
 * so online and offline paths can't drift apart (and notifications are
 * cancelled/kept identically in both).
 *
 * Reads: when offline, `hydrate()` serves the last-synced snapshot from
 * `sync_cache` instead of erroring.
 *
 * Queue-invisible by design: queued changes are NOT applied to local state,
 * so `edit`/`archive`/`remove` always target real (synced) ids — no temp ids
 * or remapping. Ops are never dropped — a failed op halts the flush, records
 * `attempts`/`last_error`, and is retried on the next flush.
 */

import { getDatabase } from '@/db/client';
import {
  clearAllNotificationIds,
  deleteNotificationId,
  getAllNotificationIds,
  setNotificationId,
} from '@/db/notification-sidecar';
import {
  deleteAllSubscriptions,
  deleteSubscription,
  getAllSubscriptions,
  insertSubscription,
  setArchived,
  updateSubscription,
} from '@/db/queries';
import { getNetworkReachability } from '@/db/network';
import { isSessionExpiredError } from '@/lib/session-errors';
import {
  cancelRenewalReminder,
  rescheduleRenewalReminder,
  scheduleRenewalReminder,
} from '@/utils/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Subscription, SubscriptionDraft, SubscriptionPatch } from '@/types/subscription';

// --- Errors -----------------------------------------------------------------

/** True when a network error (rather than a server-side one) occurred. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const message = e instanceof Error ? e.message : String(e);
  return /network request failed|fetch failed|temporarily unavailable/i.test(message);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Unknown error';
}

// --- Cache ------------------------------------------------------------------

function cacheKey(scope: string, userId: string): string {
  return `${scope}:${userId}`;
}

export async function readCache<T>(scope: string, userId: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_cache WHERE key = ?;',
    cacheKey(scope, userId),
  );
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function writeCache(scope: string, userId: string, value: unknown): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_cache (key, value, updated_at) VALUES (?, ?, ?);',
    [cacheKey(scope, userId), JSON.stringify(value), Date.now()],
  );
}

export async function clearCacheForUser(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_cache WHERE key LIKE ?;', `%:${userId}`);
}

// --- Queue ------------------------------------------------------------------

export type QueueOpType = 'add' | 'edit' | 'archive' | 'remove' | 'clear_all' | 'prefs';

/** Typed payload per queue op type — the queue is JSON, the types are real. */
type QueuePayloadMap = {
  add: { draft: SubscriptionDraft };
  edit: { id: string; patch: SubscriptionPatch };
  archive: { id: string; archived: boolean };
  remove: { id: string };
  clear_all: Record<string, unknown>;
  prefs: {
    prefs: {
      currency: string;
      budget: number;
      reminders_enabled: boolean;
      updated_at: number;
    };
  };
};

/** A mutation ready to apply online or enqueue offline. */
export type SyncOp = { [T in QueueOpType]: { type: T } & QueuePayloadMap[T] }[QueueOpType];

/** Everything the pipeline needs from the caller's context. */
export interface SyncContext {
  userId: string;
  includeSeeded: boolean;
  remindersEnabled: boolean;
}

export interface QueueOp {
  opId: string;
  userId: string;
  type: QueueOpType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

export type MutateResult =
  | { status: 'synced'; row: Subscription | null; subs: Subscription[] | null }
  | { status: 'queued' }
  | { status: 'session-expired' }
  | { status: 'error'; message: string };

function generateOpId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Enqueue a write op for a user (FIFO by created_at). */
export async function enqueueOp(
  userId: string,
  type: QueueOpType,
  payload: Record<string, unknown>,
): Promise<QueueOp> {
  const db = await getDatabase();
  const op: QueueOp = {
    opId: generateOpId(),
    userId,
    type,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  await db.runAsync(
    `INSERT INTO sync_queue (op_id, user_id, type, payload, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL);`,
    [op.opId, op.userId, op.type, JSON.stringify(op.payload), op.createdAt],
  );
  return op;
}

/** Pending ops for a user, oldest first. */
export async function getPendingOps(userId: string): Promise<QueueOp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    op_id: string;
    user_id: string;
    type: QueueOpType;
    payload: string;
    created_at: number;
    attempts: number;
    last_error: string | null;
  }>('SELECT * FROM sync_queue WHERE user_id = ? ORDER BY created_at ASC;', userId);
  return rows.map((r) => ({
    opId: r.op_id,
    userId: r.user_id,
    type: r.type,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
  }));
}

export async function pendingOpCount(userId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_queue WHERE user_id = ?;',
    userId,
  );
  return row?.n ?? 0;
}

async function markOpSuccess(opId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE op_id = ?;', opId);
}

async function markOpFailure(opId: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE op_id = ?;',
    [error, opId],
  );
}

/** Drop queued prefs ops (coalescing: a direct write supersedes them). */
export async function clearQueuedPrefs(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM sync_queue WHERE user_id = ? AND type = 'prefs';", userId);
}

/** Wipe a user's queue (account deletion). */
export async function clearQueueForUser(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE user_id = ?;', userId);
}

// --- Pipeline ---------------------------------------------------------------

function stripType(op: SyncOp): Record<string, unknown> {
  const { type: _type, ...payload } = op;
  return payload as Record<string, unknown>;
}

function syncOpFromQueue(op: QueueOp): SyncOp {
  return { type: op.type, ...op.payload } as SyncOp;
}

/**
 * Apply a mutation: online → write + notify + cache + re-read; offline (or
 * on a network failure) → enqueue and report `queued`. Error classification
 * lives here: session-death errors are reported separately so callers can
 * expire the session; everything else surfaces as a message.
 */
export async function applyMutation(op: SyncOp, ctx: SyncContext): Promise<MutateResult> {
  try {
    if ((await getNetworkReachability()) === false) {
      await enqueueOp(ctx.userId, op.type, stripType(op));
      return { status: 'queued' };
    }
    const row = await executeOp(op, ctx);
    if (op.type === 'prefs') {
      // Coalescing: this direct write supersedes any queued prefs ops.
      await clearQueuedPrefs(ctx.userId);
      await writeCache('prefs', ctx.userId, {
        currency: op.prefs.currency,
        budget: Number(op.prefs.budget),
        remindersEnabled: op.prefs.reminders_enabled,
      });
      return { status: 'synced', row: null, subs: null };
    }
    const subs = await getAllSubscriptions(ctx.includeSeeded);
    if (ctx.userId) await writeCache('subs', ctx.userId, subs);
    return { status: 'synced', row, subs };
  } catch (e) {
    if (isNetworkError(e)) {
      await enqueueOp(ctx.userId, op.type, stripType(op));
      return { status: 'queued' };
    }
    if (isSessionExpiredError(e)) return { status: 'session-expired' };
    return { status: 'error', message: errorMessage(e) };
  }
}

export interface FlushResult {
  applied: number;
  failed: number;
  error: string | null;
}

/** Replay a user's queued ops in order. Halts on the first failure. */
export async function flushPendingOps(
  userId: string,
  ctx: Pick<SyncContext, 'includeSeeded' | 'remindersEnabled'>,
): Promise<FlushResult> {
  if (!isSupabaseConfigured) return { applied: 0, failed: 0, error: null };
  const ops = await getPendingOps(userId);
  let applied = 0;
  for (const op of ops) {
    try {
      await executeOp(syncOpFromQueue(op), { userId, ...ctx });
      await markOpSuccess(op.opId);
      applied += 1;
    } catch (e) {
      const message = errorMessage(e);
      await markOpFailure(op.opId, message);
      return { applied, failed: ops.length - applied, error: message };
    }
  }
  return { applied, failed: 0, error: null };
}

/**
 * Per-type execution — the single implementation of what a mutation does to
 * the server, the notification sidecar, and the OS. Used by both
 * `applyMutation` (online) and `flushPendingOps` (replay), so the two paths
 * can never drift. Returns the written row (add/edit/archive) or null.
 */
async function executeOp(op: SyncOp, ctx: SyncContext): Promise<Subscription | null> {
  switch (op.type) {
    case 'add': {
      const created = await insertSubscription(op.draft);
      const notificationId = await scheduleRenewalReminder(created, ctx.remindersEnabled);
      if (notificationId) await setNotificationId(created.id, notificationId);
      return created;
    }
    case 'edit': {
      // Cancel the previous reminder, apply the patch, schedule the new one.
      const sidecar = await getAllNotificationIds();
      const row = await updateSubscription(op.id, op.patch);
      if (!row) return null;
      const notificationId = await rescheduleRenewalReminder(
        row,
        sidecar[op.id],
        ctx.remindersEnabled,
      );
      if (notificationId) await setNotificationId(row.id, notificationId);
      return row;
    }
    case 'archive': {
      const sidecar = await getAllNotificationIds();
      if (op.archived) await cancelRenewalReminder(sidecar[op.id]);
      const row = await setArchived(op.id, op.archived);
      if (row && op.archived) await deleteNotificationId(op.id);
      return row;
    }
    case 'remove': {
      const sidecar = await getAllNotificationIds();
      await cancelRenewalReminder(sidecar[op.id]);
      await deleteSubscription(op.id);
      return null;
    }
    case 'clear_all': {
      await deleteAllSubscriptions();
      await clearAllNotificationIds();
      return null;
    }
    case 'prefs': {
      const { error } = await supabase.from('user_prefs').upsert(op.prefs);
      if (error) throw new Error(error.message);
      return null;
    }
  }
}
