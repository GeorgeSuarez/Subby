/**
 * Offline queue coordinator tests.
 *
 * The coordinator's external dependencies (SQLite handle, network probe,
 * query layer, notification sidecar, Supabase prefs upsert) are injected via
 * `setSyncDeps` with faithful doubles: the SQLite stand-in is a tiny
 * in-memory implementation of the exact statements the module issues.
 */

import type { SQLiteBindValue } from 'expo-sqlite';

import {
  applyMutation,
  clearCacheForUser,
  clearQueuedPrefs,
  enqueueOp,
  flushPendingOps,
  getPendingOps,
  pendingOpCount,
  readCache,
  setSyncDeps,
  writeCache,
  type SyncDb,
  type SyncDeps,
  type SyncSupabase,
} from '@/db/offline';
import { isSessionExpiredError } from '@/lib/session-errors';
import type { Subscription, SubscriptionDraft } from '@/types/subscription';

const cache = new Map<string, { value: string; updated_at: number }>();
const queue: Array<{
  op_id: string;
  user_id: string;
  type: string;
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
}> = [];

/** A complete Subscription for the typed query doubles. */
const sub = (
  id: string,
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id,
  name: 'Sub',
  amount: 1,
  currency: 'USD',
  cycle: 'monthly',
  nextRenewal: '2026-09-01',
  category: 'other',
  icon: 'cube-outline',
  createdAt: 0,
  updatedAt: 0,
  archived: false,
  ...overrides,
});

/**
 * The module binds values either as a single array or as variadic args; the
 * stand-in normalizes both forms into one list.
 */
const boundValues = (
  paramsOrFirst: SQLiteBindValue | SQLiteBindValue[],
  rest: SQLiteBindValue[],
): SQLiteBindValue[] =>
  Array.isArray(paramsOrFirst) ? paramsOrFirst : [paramsOrFirst, ...rest];

/** In-memory stand-in for the exact statements the coordinator issues. */
const db: SyncDb = {
  getFirstAsync: async function getFirstAsync<T>(
    sql: string,
    paramsOrFirst: SQLiteBindValue | SQLiteBindValue[],
    ...rest: SQLiteBindValue[]
  ): Promise<T | null> {
    const p = boundValues(paramsOrFirst, rest)[0];
    if (sql.includes('sync_cache') && sql.includes('WHERE key = ?')) {
      const row = cache.get(String(p));
      // SAFETY: the module queries with the matching row shape; this
      // stand-in returns exactly what the real DB would for that query.
      return (row ? { value: row.value } : null) as T | null;
    }
    if (sql.includes('sync_queue') && sql.includes('COUNT(*)')) {
      // SAFETY: the COUNT query always reads `n` — see pendingOpCount.
      return {
        n: queue.filter((o) => o.user_id === String(p)).length,
      } as T | null;
    }
    return null;
  },
  getAllAsync: async function getAllAsync<T>(
    sql: string,
    paramsOrFirst: SQLiteBindValue | SQLiteBindValue[],
    ...rest: SQLiteBindValue[]
  ): Promise<T[]> {
    const params = boundValues(paramsOrFirst, rest);
    if (sql.includes('SELECT * FROM sync_queue')) {
      const rows = queue
        .filter((o) => o.user_id === String(params[0]))
        .sort((a, b) => a.created_at - b.created_at)
        .map((o) => ({ ...o }));
      // SAFETY: getPendingOps maps these exact columns into QueueOp.
      return rows as T[];
    }
    return [];
  },
  runAsync: async (
    sql: string,
    paramsOrFirst: SQLiteBindValue | SQLiteBindValue[],
    ...rest: SQLiteBindValue[]
  ) => {
    const args = boundValues(paramsOrFirst, rest);
    if (sql.includes('INSERT OR REPLACE INTO sync_cache')) {
      cache.set(String(args[0]), {
        value: String(args[1]),
        updated_at: Number(args[2]),
      });
    } else if (sql.includes('DELETE FROM sync_cache')) {
      const pattern = String(args[0]);
      for (const key of Array.from(cache.keys())) {
        if (key.endsWith(`:${pattern.slice(2)}`) || key === pattern.slice(1)) {
          cache.delete(key);
        }
      }
      if (pattern === ':%') {
        cache.clear();
      }
    } else if (sql.includes('INSERT INTO sync_queue')) {
      queue.push({
        op_id: String(args[0]),
        user_id: String(args[1]),
        type: String(args[2]),
        payload: String(args[3]),
        created_at: Number(args[4]),
        attempts: 0,
        last_error: null,
      });
    } else if (sql.includes('DELETE FROM sync_queue')) {
      if (sql.includes("AND type = 'prefs'")) {
        const uid = String(args[0]);
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i]?.user_id === uid && queue[i]?.type === 'prefs')
            queue.splice(i, 1);
        }
      } else if (sql.includes('WHERE user_id = ?')) {
        const uid = String(args[0]);
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i]?.user_id === uid) queue.splice(i, 1);
        }
      } else {
        const opId = String(args[0]);
        const idx = queue.findIndex((o) => o.op_id === opId);
        if (idx >= 0) queue.splice(idx, 1);
      }
    } else if (sql.includes('UPDATE sync_queue')) {
      const opId = String(args[1]);
      const op = queue.find((o) => o.op_id === opId);
      if (op) {
        op.attempts += 1;
        op.last_error = String(args[0]);
      }
    }
    return { changes: 0, lastInsertRowId: 0 };
  },
};

const supabase: SyncSupabase = {
  from: () => ({
    upsert: jest.fn(async () => ({ error: null })),
  }),
};

const syncDeps: SyncDeps = {
  getDatabase: async () => db,
  getNetworkReachability: jest.fn(async () => true),
  isSessionExpiredError,
  isSupabaseConfigured: true,
  supabase,
  getAllSubscriptions: jest.fn(async () => [sub('re-read')]),
  insertSubscription: jest.fn(async (draft: SubscriptionDraft) =>
    sub('real-id', { name: draft.name }),
  ),
  updateSubscription: jest.fn(async (id: string) => sub(id)),
  setArchived: jest.fn(async (id: string, archived: boolean) =>
    sub(id, { archived }),
  ),
  deleteSubscription: jest.fn(async () => undefined),
  deleteAllSubscriptions: jest.fn(async () => undefined),
  clearAllNotificationIds: jest.fn(async () => undefined),
  deleteNotificationId: jest.fn(async () => undefined),
  getAllNotificationIds: jest.fn(async () => ({})),
  setNotificationId: jest.fn(async () => undefined),
  scheduleRenewalReminder: jest.fn(async () => 'notif-id'),
  rescheduleRenewalReminder: jest.fn(async () => 'notif-id'),
  cancelRenewalReminder: jest.fn(async () => undefined),
};

const USER = 'user-1';
const CTX = { includeSeeded: false, remindersEnabled: true };

/** A complete SubscriptionDraft for the typed `add` op. */
const draft = (
  overrides: Partial<SubscriptionDraft> = {},
): SubscriptionDraft => ({
  name: 'Netflix',
  amount: '15.99',
  currency: 'USD',
  cycle: 'monthly',
  nextRenewal: '2026-09-01',
  category: 'streaming',
  icon: 'film-outline',
  ...overrides,
});

// SAFETY: the network double is a jest.fn; the alias widens it back to Mock.
const network = syncDeps.getNetworkReachability as jest.Mock;
// SAFETY: these query doubles are jest.fn instances; the aliases only widen
// them back to the Mock shape so tests can stub/assert call behavior.
const queries = {
  insertSubscription: syncDeps.insertSubscription as jest.Mock,
  updateSubscription: syncDeps.updateSubscription as jest.Mock,
  setArchived: syncDeps.setArchived as jest.Mock,
  deleteSubscription: syncDeps.deleteSubscription as jest.Mock,
  deleteAllSubscriptions: syncDeps.deleteAllSubscriptions as jest.Mock,
};
// SAFETY: same widening for the notification doubles.
const notifications = {
  scheduleRenewalReminder: syncDeps.scheduleRenewalReminder as jest.Mock,
  cancelRenewalReminder: syncDeps.cancelRenewalReminder as jest.Mock,
};
// SAFETY: same widening for the notification-sidecar doubles.
const sidecar = {
  getAllNotificationIds: syncDeps.getAllNotificationIds as jest.Mock,
  clearAllNotificationIds: syncDeps.clearAllNotificationIds as jest.Mock,
};

let previousDeps: SyncDeps | null;

beforeAll(() => {
  previousDeps = setSyncDeps(syncDeps);
});

afterAll(() => {
  setSyncDeps(previousDeps);
});

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  queue.length = 0;
  syncDeps.isSupabaseConfigured = true;
  network.mockResolvedValue(true);
});

describe('cache', () => {
  it('round-trips snapshots per scope+user', async () => {
    await writeCache('subs', USER, [{ id: 'a' }]);
    expect(await readCache('subs', USER)).toEqual([{ id: 'a' }]);
    expect(await readCache('subs', 'other-user')).toBeNull();
    await clearCacheForUser(USER);
    expect(await readCache('subs', USER)).toBeNull();
  });
});

describe('queue storage', () => {
  it('enqueues and lists ops FIFO per user', async () => {
    await enqueueOp(USER, 'add', { draft: draft({ name: 'Netflix' }) });
    await enqueueOp(USER, 'edit', { id: 'x', patch: { amount: '9.99' } });
    await enqueueOp('other', 'add', { draft: draft({ name: 'Spotify' }) });

    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['add', 'edit']);
    expect(ops[0]?.createdAt).toBeLessThanOrEqual(ops[1]!.createdAt);
    expect(await pendingOpCount(USER)).toBe(2);
  });
});

describe('applyMutation', () => {
  it('writes online, schedules notifications, caches, and re-reads', async () => {
    const result = await applyMutation(
      { type: 'add', draft: draft() },
      { userId: USER, ...CTX },
    );

    expect(result.status).toBe('synced');
    if (result.status === 'synced') {
      expect(result.row).toMatchObject({ id: 'real-id' });
      expect(result.subs).toMatchObject([{ id: 're-read' }]);
    }
    expect(queries.insertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Netflix', amount: '15.99' }),
    );
    expect(notifications.scheduleRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'real-id' }),
      true,
    );
    expect(await readCache('subs', USER)).toMatchObject([{ id: 're-read' }]);
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('queues when offline instead of writing', async () => {
    network.mockResolvedValue(false);

    const result = await applyMutation(
      { type: 'archive', id: 'y', archived: true },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'queued' });
    expect(queries.setArchived).not.toHaveBeenCalled();
    expect(await pendingOpCount(USER)).toBe(1);
  });

  it('queues on a network failure mid-write', async () => {
    queries.insertSubscription.mockRejectedValueOnce(
      new TypeError('Network request failed'),
    );

    const result = await applyMutation(
      { type: 'add', draft: draft({ name: 'Netflix' }) },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'queued' });
    expect(await pendingOpCount(USER)).toBe(1);
  });

  it('reports session-death errors separately', async () => {
    queries.insertSubscription.mockRejectedValueOnce(
      new Error(
        'new row violates foreign key constraint "subscriptions_user_id_fkey"',
      ),
    );

    const result = await applyMutation(
      { type: 'add', draft: draft({ name: 'Netflix' }) },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'session-expired' });
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('cancels the reminder on remove (online path)', async () => {
    sidecar.getAllNotificationIds.mockResolvedValueOnce({
      y: 'notif-y',
    });

    const result = await applyMutation(
      { type: 'remove', id: 'y' },
      { userId: USER, ...CTX },
    );

    expect(result.status).toBe('synced');
    expect(notifications.cancelRenewalReminder).toHaveBeenCalledWith('notif-y');
    expect(queries.deleteSubscription).toHaveBeenCalledWith('y');
  });

  it('cancels reminders on clear_all', async () => {
    const result = await applyMutation(
      { type: 'clear_all', cleared: true },
      { userId: USER, ...CTX },
    );

    expect(result.status).toBe('synced');
    expect(queries.deleteAllSubscriptions).toHaveBeenCalled();
    expect(sidecar.clearAllNotificationIds).toHaveBeenCalled();
  });

  it('coalesces queued prefs and caches the fresh prefs on a direct write', async () => {
    await enqueueOp(USER, 'prefs', {
      prefs: {
        currency: 'EUR',
        budget: 0,
        reminders_enabled: true,
        updated_at: 1,
      },
    });
    await enqueueOp(USER, 'add', { draft: draft({ name: 'Netflix' }) });

    const result = await applyMutation(
      {
        type: 'prefs',
        prefs: {
          currency: 'GBP',
          budget: 200,
          reminders_enabled: false,
          updated_at: 2,
        },
      },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'synced', row: null, subs: null });
    expect(await readCache('prefs', USER)).toEqual({
      currency: 'GBP',
      budget: 200,
      remindersEnabled: false,
    });
    // Only the prefs op was coalesced away; the add op remains queued.
    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['add']);
  });
});

describe('flush', () => {
  it('replays ops in order and empties the queue on success', async () => {
    await enqueueOp(USER, 'add', { draft: draft() });
    await enqueueOp(USER, 'edit', { id: 'x', patch: { amount: '17.99' } });
    await enqueueOp(USER, 'archive', { id: 'y', archived: true });
    await enqueueOp(USER, 'prefs', {
      prefs: {
        currency: 'EUR',
        budget: 100,
        reminders_enabled: true,
        updated_at: 1,
      },
    });

    const result = await flushPendingOps(USER, CTX);

    expect(result).toEqual({ applied: 4, failed: 0, error: null });
    expect(queries.insertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Netflix', amount: '15.99' }),
    );
    expect(queries.updateSubscription).toHaveBeenCalledWith('x', {
      amount: '17.99',
    });
    expect(queries.setArchived).toHaveBeenCalledWith('y', true);
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('cancels the reminder when replaying a remove (the offline path)', async () => {
    sidecar.getAllNotificationIds.mockResolvedValueOnce({
      y: 'notif-y',
    });
    await enqueueOp(USER, 'remove', { id: 'y' });

    const result = await flushPendingOps(USER, CTX);

    expect(result).toEqual({ applied: 1, failed: 0, error: null });
    expect(notifications.cancelRenewalReminder).toHaveBeenCalledWith('notif-y');
  });

  it('halts on the first failure and keeps the op with attempts/error', async () => {
    queries.updateSubscription.mockRejectedValueOnce(new Error('RLS blocked'));
    await enqueueOp(USER, 'add', { draft: draft({ name: 'Netflix' }) });
    await enqueueOp(USER, 'edit', { id: 'x', patch: {} });

    const result = await flushPendingOps(USER, CTX);

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.error).toBe('RLS blocked');
    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['edit']);
    expect(ops[0]?.attempts).toBe(1);
    expect(ops[0]?.lastError).toBe('RLS blocked');
  });

  it('is a no-op when Supabase is unconfigured', async () => {
    syncDeps.isSupabaseConfigured = false;
    const result = await flushPendingOps(USER, CTX);
    expect(result).toEqual({ applied: 0, failed: 0, error: null });
  });
});

describe('prefs coalescing', () => {
  it('removes only queued prefs ops', async () => {
    await enqueueOp(USER, 'prefs', {
      prefs: {
        currency: 'EUR',
        budget: 0,
        reminders_enabled: true,
        updated_at: 1,
      },
    });
    await enqueueOp(USER, 'add', { draft: draft({ name: 'Netflix' }) });
    await clearQueuedPrefs(USER);

    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['add']);
  });
});
