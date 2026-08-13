/**
 * Offline queue coordinator tests.
 *
 * The real storage is expo-sqlite (native); `@/db/client` is mocked with a
 * tiny in-memory SQLite stand-in that understands the exact statements the
 * module issues, and the Supabase/query/notification layers are mocked.
 */

import {
  applyMutation,
  clearCacheForUser,
  clearQueuedPrefs,
  enqueueOp,
  flushPendingOps,
  getPendingOps,
  pendingOpCount,
  readCache,
  writeCache,
} from '@/db/offline';
import type { SubscriptionDraft } from '@/types/subscription';

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

jest.mock('@/db/client', () => ({
  getDatabase: jest.fn(async () => ({
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      const p = params[0];
      if (sql.includes('sync_cache') && sql.includes('WHERE key = ?')) {
        const row = cache.get(p as string);
        return row ? { value: row.value } : null;
      }
      if (sql.includes('sync_queue') && sql.includes('COUNT(*)')) {
        return { n: queue.filter((o) => o.user_id === p).length };
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('SELECT * FROM sync_queue')) {
        return queue
          .filter((o) => o.user_id === params[0])
          .sort((a, b) => a.created_at - b.created_at)
          .map((o) => ({ ...o }));
      }
      return [];
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      // The module passes bound values either as an array or as spread args.
      const args = Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
      if (sql.includes('INSERT OR REPLACE INTO sync_cache')) {
        cache.set(args[0] as string, { value: args[1] as string, updated_at: args[2] as number });
      } else if (sql.includes('DELETE FROM sync_cache')) {
        const pattern = args[0] as string;
        for (const key of [...cache.keys()]) {
          if (key.endsWith(`:${pattern.slice(2)}`) || key === pattern.slice(1)) {
            cache.delete(key);
          }
        }
        if (pattern === ':%') {
          cache.clear();
        }
      } else if (sql.includes('INSERT INTO sync_queue')) {
        queue.push({
          op_id: args[0] as string,
          user_id: args[1] as string,
          type: args[2] as string,
          payload: args[3] as string,
          created_at: args[4] as number,
          attempts: 0,
          last_error: null,
        });
      } else if (sql.includes('DELETE FROM sync_queue')) {
        if (sql.includes("AND type = 'prefs'")) {
          const uid = args[0] as string;
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i]?.user_id === uid && queue[i]?.type === 'prefs') queue.splice(i, 1);
          }
        } else if (sql.includes('WHERE user_id = ?')) {
          const uid = args[0] as string;
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i]?.user_id === uid) queue.splice(i, 1);
          }
        } else {
          const opId = args[0] as string;
          const idx = queue.findIndex((o) => o.op_id === opId);
          if (idx >= 0) queue.splice(idx, 1);
        }
      } else if (sql.includes('UPDATE sync_queue')) {
        const opId = args[1] as string;
        const op = queue.find((o) => o.op_id === opId);
        if (op) {
          op.attempts += 1;
          op.last_error = args[0] as string;
        }
      }
    }),
  })),
}));

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(async () => ({ error: null })),
    })),
  },
}));

jest.mock('@/db/network', () => ({
  getNetworkReachability: jest.fn(async () => true),
}));

jest.mock('@/db/queries', () => ({
  getAllSubscriptions: jest.fn(async () => [{ id: 're-read' }]),
  insertSubscription: jest.fn(async (draft: unknown) => ({ ...(draft as object), id: 'real-id' })),
  updateSubscription: jest.fn(async (id: string) => ({ id, name: 'updated' })),
  setArchived: jest.fn(async (id: string, archived: boolean) => ({ id, archived })),
  deleteSubscription: jest.fn(async () => undefined),
  deleteAllSubscriptions: jest.fn(async () => undefined),
}));

jest.mock('@/db/notification-sidecar', () => ({
  getAllNotificationIds: jest.fn(async () => ({})),
  setNotificationId: jest.fn(async () => undefined),
  deleteNotificationId: jest.fn(async () => undefined),
  clearAllNotificationIds: jest.fn(async () => undefined),
}));

jest.mock('@/utils/notifications', () => ({
  scheduleRenewalReminder: jest.fn(async () => 'notif-id'),
  rescheduleRenewalReminder: jest.fn(async () => 'notif-id'),
  cancelRenewalReminder: jest.fn(async () => undefined),
}));

const queries = jest.requireMock('@/db/queries') as Record<string, jest.Mock>;
const notifications = jest.requireMock('@/utils/notifications') as Record<string, jest.Mock>;
const network = jest.requireMock('@/db/network') as { getNetworkReachability: jest.Mock };
const USER = 'user-1';
const CTX = { includeSeeded: false, remindersEnabled: true };

/** A complete SubscriptionDraft for the typed `add` op. */
const draft = (overrides: Partial<SubscriptionDraft> = {}): SubscriptionDraft => ({
  name: 'Netflix',
  amount: '15.99',
  currency: 'USD',
  cycle: 'monthly',
  nextRenewal: '2026-09-01',
  category: 'streaming',
  icon: 'film-outline',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  queue.length = 0;
  network.getNetworkReachability.mockResolvedValue(true);
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
      expect(result.subs).toEqual([{ id: 're-read' }]);
    }
    expect(queries.insertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Netflix', amount: '15.99' }),
    );
    expect(notifications.scheduleRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'real-id' }),
      true,
    );
    expect(await readCache('subs', USER)).toEqual([{ id: 're-read' }]);
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('queues when offline instead of writing', async () => {
    network.getNetworkReachability.mockResolvedValue(false);

    const result = await applyMutation(
      { type: 'archive', id: 'y', archived: true },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'queued' });
    expect(queries.setArchived).not.toHaveBeenCalled();
    expect(await pendingOpCount(USER)).toBe(1);
  });

  it('queues on a network failure mid-write', async () => {
    queries.insertSubscription.mockRejectedValueOnce(new TypeError('Network request failed'));

    const result = await applyMutation(
      { type: 'add', draft: draft({ name: 'Netflix' }) },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'queued' });
    expect(await pendingOpCount(USER)).toBe(1);
  });

  it('reports session-death errors separately', async () => {
    queries.insertSubscription.mockRejectedValueOnce(
      new Error('new row violates foreign key constraint "subscriptions_user_id_fkey"'),
    );

    const result = await applyMutation(
      { type: 'add', draft: draft({ name: 'Netflix' }) },
      { userId: USER, ...CTX },
    );

    expect(result).toEqual({ status: 'session-expired' });
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('cancels the reminder on remove (online path)', async () => {
    jest.requireMock('@/db/notification-sidecar').getAllNotificationIds.mockResolvedValueOnce({
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
    const result = await applyMutation({ type: 'clear_all' }, { userId: USER, ...CTX });

    expect(result.status).toBe('synced');
    expect(queries.deleteAllSubscriptions).toHaveBeenCalled();
    expect(jest.requireMock('@/db/notification-sidecar').clearAllNotificationIds).toHaveBeenCalled();
  });

  it('coalesces queued prefs and caches the fresh prefs on a direct write', async () => {
    await enqueueOp(USER, 'prefs', { prefs: { currency: 'EUR' } });
    await enqueueOp(USER, 'add', { draft: draft({ name: 'Netflix' }) });

    const result = await applyMutation(
      {
        type: 'prefs',
        prefs: { currency: 'GBP', budget: 200, reminders_enabled: false, updated_at: 2 },
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
      prefs: { currency: 'EUR', budget: 100, reminders_enabled: true, updated_at: 1 },
    });

    const result = await flushPendingOps(USER, CTX);

    expect(result).toEqual({ applied: 4, failed: 0, error: null });
    expect(queries.insertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Netflix', amount: '15.99' }),
    );
    expect(queries.updateSubscription).toHaveBeenCalledWith('x', { amount: '17.99' });
    expect(queries.setArchived).toHaveBeenCalledWith('y', true);
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('cancels the reminder when replaying a remove (the offline path)', async () => {
    jest.requireMock('@/db/notification-sidecar').getAllNotificationIds.mockResolvedValueOnce({
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
    jest.requireMock('@/lib/supabase').isSupabaseConfigured = false;
    const result = await flushPendingOps(USER, CTX);
    expect(result).toEqual({ applied: 0, failed: 0, error: null });
    jest.requireMock('@/lib/supabase').isSupabaseConfigured = true;
  });
});

describe('prefs coalescing', () => {
  it('removes only queued prefs ops', async () => {
    await enqueueOp(USER, 'prefs', { prefs: { currency: 'EUR' } });
    await enqueueOp(USER, 'add', { draft: draft({ name: 'Netflix' }) });
    await clearQueuedPrefs(USER);

    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['add']);
  });
});
