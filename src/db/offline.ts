/**
 * Offline sync layer: per-user read cache + FIFO write queue.
 *
 * Reads: when offline, `hydrate()` serves the last-synced snapshot from
 * `sync_cache` instead of erroring.
 *
 * Writes: mutations made while offline are enqueued in `sync_queue` (keyed by
 * the owning user) and replayed in order by `flushPendingOps` when
 * connectivity returns. Ops are never dropped — a failed op halts the flush,
 * records `attempts`/`last_error`, and is retried on the next flush.
 *
 * Queue-invisible by design: queued changes are NOT applied to local state,
 * so `edit`/`archive`/`remove` always target real (synced) ids — no temp ids
 * or remapping.
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
  insertSubscription,
  setArchived,
  updateSubscription,
} from '@/db/queries';
import {
  cancelRenewalReminder,
  rescheduleRenewalReminder,
  scheduleRenewalReminder,
} from '@/utils/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SubscriptionDraft, SubscriptionPatch } from '@/types/subscription';

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

export interface QueueOp {
  opId: string;
  userId: string;
  type: QueueOpType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

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

// --- Flush ------------------------------------------------------------------

export interface FlushResult {
  applied: number;
  failed: number;
  error: string | null;
}

/** Replay a user's queued ops in order. Halts on the first failure. */
export async function flushPendingOps(userId: string): Promise<FlushResult> {
  if (!isSupabaseConfigured) return { applied: 0, failed: 0, error: null };
  const ops = await getPendingOps(userId);
  let applied = 0;
  for (const op of ops) {
    try {
      await executeOp(op);
      await markOpSuccess(op.opId);
      applied += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown sync error';
      await markOpFailure(op.opId, message);
      return { applied, failed: ops.length - applied, error: message };
    }
  }
  return { applied, failed: 0, error: null };
}

async function executeOp(op: QueueOp): Promise<void> {
  switch (op.type) {
    case 'add': {
      const created = await insertSubscription(op.payload as unknown as SubscriptionDraft);
      const notificationId = await scheduleRenewalReminder(created);
      if (notificationId) await setNotificationId(created.id, notificationId);
      return;
    }
    case 'edit': {
      const { id, patch } = op.payload as { id: string; patch: SubscriptionPatch };
      // Cancel the previous reminder before the patch (renewal may change).
      const sidecar = await getAllNotificationIds();
      await cancelRenewalReminder(sidecar[id]);
      const updated = await updateSubscription(id, patch);
      if (!updated) return;
      const notificationId = await rescheduleRenewalReminder(updated);
      if (notificationId) await setNotificationId(updated.id, notificationId);
      return;
    }
    case 'archive': {
      const { id, archived } = op.payload as { id: string; archived: boolean };
      const sidecar = await getAllNotificationIds();
      if (archived) await cancelRenewalReminder(sidecar[id]);
      const updated = await setArchived(id, archived);
      if (updated && archived) await deleteNotificationId(id);
      return;
    }
    case 'remove': {
      const { id } = op.payload as { id: string };
      await deleteSubscription(id);
      return;
    }
    case 'clear_all': {
      await deleteAllSubscriptions();
      await clearAllNotificationIds();
      return;
    }
    case 'prefs': {
      const { error } = await supabase.from('user_prefs').upsert(op.payload);
      if (error) throw new Error(error.message);
      return;
    }
  }
}
