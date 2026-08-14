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
 *
 * Dependencies: the module never imports native/remote modules at the top
 * level. `setSyncDeps` swaps them (tests install faithful doubles); the
 * production wiring is built lazily on first use so the module stays
 * loadable in a plain-node Jest environment.
 */

import type { SQLiteBindValue, SQLiteRunResult } from 'expo-sqlite';

import { isSessionExpiredError } from '@/lib/session-errors';
import type { NetworkReachability } from '@/db/network';
import type {
  Subscription,
  SubscriptionDraft,
  SubscriptionPatch,
} from '@/types/subscription';

// --- Errors -----------------------------------------------------------------

/** True when a network error (rather than a server-side one) occurred. */
export function isNetworkError(e: Error): boolean {
  if (e instanceof TypeError) return true;
  return /network request failed|fetch failed|temporarily unavailable/i.test(
    e.message,
  );
}

// --- Dependencies -----------------------------------------------------------

/** The SQLite surface the coordinator touches (mirrors expo-sqlite's
 * `SQLiteDatabase` bind forms: a single array, or variadic values). */
export interface SyncDb {
  getFirstAsync<T>(
    source: string,
    params: SQLiteBindValue[],
  ): Promise<T | null>;
  getFirstAsync<T>(
    source: string,
    ...params: SQLiteBindValue[]
  ): Promise<T | null>;
  getAllAsync<T>(source: string, params: SQLiteBindValue[]): Promise<T[]>;
  getAllAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  runAsync(source: string, params: SQLiteBindValue[]): Promise<SQLiteRunResult>;
  runAsync(
    source: string,
    ...params: SQLiteBindValue[]
  ): Promise<SQLiteRunResult>;
}

/** The prefs row the pipeline upserts into `user_prefs`. */
export interface SyncPrefsPayload {
  currency: string;
  budget: number;
  reminders_enabled: boolean;
  updated_at: number;
}

/** The Supabase surface the pipeline touches (user_prefs upserts). */
export interface SyncSupabase {
  from: (table: string) => {
    upsert: (
      value: SyncPrefsPayload,
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
}

/** Everything the coordinator needs from the outside world. */
export interface SyncDeps {
  getDatabase: () => Promise<SyncDb>;
  getNetworkReachability: () => Promise<NetworkReachability>;
  isSessionExpiredError: (e: Error) => boolean;
  isSupabaseConfigured: boolean;
  supabase: SyncSupabase;
  getAllSubscriptions: (includeSeeded?: boolean) => Promise<Subscription[]>;
  insertSubscription: (
    draft: SubscriptionDraft,
    options?: { seeded?: boolean },
  ) => Promise<Subscription>;
  updateSubscription: (
    id: string,
    patch: SubscriptionPatch,
  ) => Promise<Subscription | null>;
  setArchived: (id: string, archived: boolean) => Promise<Subscription | null>;
  deleteSubscription: (id: string) => Promise<void>;
  deleteAllSubscriptions: () => Promise<void>;
  clearAllNotificationIds: () => Promise<void>;
  deleteNotificationId: (id: string) => Promise<void>;
  getAllNotificationIds: () => Promise<Record<string, string>>;
  setNotificationId: (id: string, notificationId: string) => Promise<void>;
  scheduleRenewalReminder: (
    sub: Subscription,
    remindersEnabled: boolean,
  ) => Promise<string | null>;
  rescheduleRenewalReminder: (
    sub: Subscription,
    previousNotificationId: string | null | undefined,
    remindersEnabled: boolean,
  ) => Promise<string | null>;
  cancelRenewalReminder: (
    notificationId: string | null | undefined,
  ) => Promise<void>;
}

let deps: SyncDeps | null = null;

/**
 * Build the production wiring. Deliberate `require` (not static `import`):
 * Metro bundles literal requires statically, and Jest's plain-node env can't
 * load the native modules (expo-sqlite, expo-notifications, expo-secure-store
 * via the Supabase client) — this runs only on first use, and only in the
 * real app.
 */
function buildDefaultDeps(): SyncDeps {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const client = require('@/db/client');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const network = require('@/db/network');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queries = require('@/db/queries');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sidecar = require('@/db/notification-sidecar');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notifications = require('@/utils/notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isSupabaseConfigured, supabase } = require('@/lib/supabase');
  return {
    getDatabase: client.getDatabase,
    getNetworkReachability: network.getNetworkReachability,
    isSessionExpiredError,
    isSupabaseConfigured,
    supabase,
    getAllSubscriptions: queries.getAllSubscriptions,
    insertSubscription: queries.insertSubscription,
    updateSubscription: queries.updateSubscription,
    setArchived: queries.setArchived,
    deleteSubscription: queries.deleteSubscription,
    deleteAllSubscriptions: queries.deleteAllSubscriptions,
    clearAllNotificationIds: sidecar.clearAllNotificationIds,
    deleteNotificationId: sidecar.deleteNotificationId,
    getAllNotificationIds: sidecar.getAllNotificationIds,
    setNotificationId: sidecar.setNotificationId,
    scheduleRenewalReminder: notifications.scheduleRenewalReminder,
    rescheduleRenewalReminder: notifications.rescheduleRenewalReminder,
    cancelRenewalReminder: notifications.cancelRenewalReminder,
  };
}

function currentDeps(): SyncDeps {
  if (deps === null) deps = buildDefaultDeps();
  return deps;
}

/**
 * Swap the coordinator's external dependencies (test seam). Returns the
 * previously installed set (or `null` before the first swap) so callers can
 * restore it. Passing `null` restores the production wiring.
 */
export function setSyncDeps(next: SyncDeps | null): SyncDeps | null {
  const previous = deps;
  deps = next;
  return previous;
}

// --- Cache ------------------------------------------------------------------

function cacheKey(scope: string, userId: string): string {
  return `${scope}:${userId}`;
}

export async function readCache<T>(
  scope: string,
  userId: string,
): Promise<T | null> {
  const db = await currentDeps().getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_cache WHERE key = ?;',
    cacheKey(scope, userId),
  );
  if (!row) return null;
  try {
    // SAFETY: the cache is written only by writeCache below, which stores
    // JSON.stringify(T); parse restores the exact written shape.
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(
  scope: string,
  userId: string,
  value: T,
): Promise<void> {
  const db = await currentDeps().getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_cache (key, value, updated_at) VALUES (?, ?, ?);',
    [cacheKey(scope, userId), JSON.stringify(value), Date.now()],
  );
}

export async function clearCacheForUser(userId: string): Promise<void> {
  const db = await currentDeps().getDatabase();
  await db.runAsync('DELETE FROM sync_cache WHERE key LIKE ?;', `%:${userId}`);
}

// --- Queue ------------------------------------------------------------------

export type QueueOpType =
  | 'add'
  | 'edit'
  | 'archive'
  | 'remove'
  | 'clear_all'
  | 'prefs';

/** Typed payload per queue op type — the queue is JSON, the types are real. */
type QueuePayloadMap = {
  add: { draft: SubscriptionDraft };
  edit: { id: string; patch: SubscriptionPatch };
  archive: { id: string; archived: boolean };
  remove: { id: string };
  /** The only possible payload is "clear everything". */
  clear_all: { cleared: boolean };
  prefs: {
    prefs: SyncPrefsPayload;
  };
};

/** The per-op payload union — what actually gets serialized to the queue. */
export type QueuePayload = {
  [T in QueueOpType]: QueuePayloadMap[T];
}[QueueOpType];

/** A mutation ready to apply online or enqueue offline. */
export type SyncOp = {
  [T in QueueOpType]: { type: T } & QueuePayloadMap[T];
}[QueueOpType];

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
  payload: QueuePayload;
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
  // globalThis (not a bare `crypto` reference): Hermes has no WebCrypto, and
  // reading an undeclared global identifier throws even with `?.` — reading a
  // missing globalThis property just yields undefined.
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
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
  payload: QueuePayload,
): Promise<QueueOp> {
  const db = await currentDeps().getDatabase();
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
  const db = await currentDeps().getDatabase();
  const rows = await db.getAllAsync<{
    op_id: string;
    user_id: string;
    type: QueueOpType;
    payload: string;
    created_at: number;
    attempts: number;
    last_error: string | null;
  }>(
    'SELECT * FROM sync_queue WHERE user_id = ? ORDER BY created_at ASC;',
    userId,
  );
  return rows.map((r) => ({
    opId: r.op_id,
    userId: r.user_id,
    type: r.type,
    // SAFETY: enqueueOp serializes a typed QueuePayload; the round-trip
    // through SQLite preserves the per-type payload shape.
    payload: JSON.parse(r.payload) as QueuePayload,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
  }));
}

export async function pendingOpCount(userId: string): Promise<number> {
  const db = await currentDeps().getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_queue WHERE user_id = ?;',
    userId,
  );
  return row?.n ?? 0;
}

async function markOpSuccess(opId: string): Promise<void> {
  const db = await currentDeps().getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE op_id = ?;', opId);
}

async function markOpFailure(opId: string, error: string): Promise<void> {
  const db = await currentDeps().getDatabase();
  await db.runAsync(
    'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE op_id = ?;',
    [error, opId],
  );
}

/** Drop queued prefs ops (coalescing: a direct write supersedes them). */
export async function clearQueuedPrefs(userId: string): Promise<void> {
  const db = await currentDeps().getDatabase();
  await db.runAsync(
    "DELETE FROM sync_queue WHERE user_id = ? AND type = 'prefs';",
    userId,
  );
}

/** Wipe a user's queue (account deletion). */
export async function clearQueueForUser(userId: string): Promise<void> {
  const db = await currentDeps().getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE user_id = ?;', userId);
}

// --- Pipeline ---------------------------------------------------------------

function stripType(op: SyncOp): QueuePayload {
  const { type: _type, ...payload } = op;
  // SAFETY: QueuePayload is exactly the per-type rest shape of a SyncOp;
  // stripping the discriminator leaves the op's payload.
  return payload as QueuePayload;
}

function syncOpFromQueue(op: QueueOp): SyncOp {
  // SAFETY: the stored payload was produced by stripType (see enqueueOp), so
  // reattaching the type key reconstructs the original discriminated op.
  return { type: op.type, ...op.payload } as SyncOp;
}

/**
 * Apply a mutation: online → write + notify + cache + re-read; offline (or
 * on a network failure) → enqueue and report `queued`. Error classification
 * lives here: session-death errors are reported separately so callers can
 * expire the session; everything else surfaces as a message.
 */
export async function applyMutation(
  op: SyncOp,
  ctx: SyncContext,
): Promise<MutateResult> {
  try {
    if ((await currentDeps().getNetworkReachability()) === false) {
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
    const subs = await currentDeps().getAllSubscriptions(ctx.includeSeeded);
    if (ctx.userId) await writeCache('subs', ctx.userId, subs);
    return { status: 'synced', row, subs };
  } catch (e) {
    // Normalize the caught value at this boundary: every thrower in the
    // pipeline rejects with an Error, so anything else folds into one here.
    const failure = e instanceof Error ? e : new Error(String(e));
    if (isNetworkError(failure)) {
      await enqueueOp(ctx.userId, op.type, stripType(op));
      return { status: 'queued' };
    }
    if (currentDeps().isSessionExpiredError(failure)) {
      return { status: 'session-expired' };
    }
    return { status: 'error', message: failure.message };
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
  if (!currentDeps().isSupabaseConfigured) {
    return { applied: 0, failed: 0, error: null };
  }
  const ops = await getPendingOps(userId);
  let applied = 0;
  for (const op of ops) {
    try {
      await executeOp(syncOpFromQueue(op), { userId, ...ctx });
      await markOpSuccess(op.opId);
      applied += 1;
    } catch (e) {
      // Same boundary normalization as applyMutation above.
      const message = e instanceof Error ? e.message : String(e);
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
async function executeOp(
  op: SyncOp,
  ctx: SyncContext,
): Promise<Subscription | null> {
  switch (op.type) {
    case 'add': {
      const created = await currentDeps().insertSubscription(op.draft);
      const notificationId = await currentDeps().scheduleRenewalReminder(
        created,
        ctx.remindersEnabled,
      );
      if (notificationId) {
        await currentDeps().setNotificationId(created.id, notificationId);
      }
      return created;
    }
    case 'edit': {
      // Cancel the previous reminder, apply the patch, schedule the new one.
      const sidecar = await currentDeps().getAllNotificationIds();
      const row = await currentDeps().updateSubscription(op.id, op.patch);
      if (!row) return null;
      const notificationId = await currentDeps().rescheduleRenewalReminder(
        row,
        sidecar[op.id],
        ctx.remindersEnabled,
      );
      if (notificationId) {
        await currentDeps().setNotificationId(row.id, notificationId);
      }
      return row;
    }
    case 'archive': {
      const sidecar = await currentDeps().getAllNotificationIds();
      if (op.archived) {
        await currentDeps().cancelRenewalReminder(sidecar[op.id]);
      }
      const row = await currentDeps().setArchived(op.id, op.archived);
      if (row && op.archived) {
        await currentDeps().deleteNotificationId(op.id);
      }
      return row;
    }
    case 'remove': {
      const sidecar = await currentDeps().getAllNotificationIds();
      await currentDeps().cancelRenewalReminder(sidecar[op.id]);
      await currentDeps().deleteSubscription(op.id);
      return null;
    }
    case 'clear_all': {
      await currentDeps().deleteAllSubscriptions();
      await currentDeps().clearAllNotificationIds();
      return null;
    }
    case 'prefs': {
      const { error } = await currentDeps()
        .supabase.from('user_prefs')
        .upsert(op.prefs);
      if (error) throw new Error(error.message);
      return null;
    }
  }
}
