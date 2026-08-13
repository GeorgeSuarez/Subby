/**
 * Offline queue coordinator tests.
 *
 * The real storage is expo-sqlite (native); `@/db/client` is mocked with a
 * tiny in-memory SQLite stand-in that understands the exact statements the
 * module issues, and the Supabase/query/notification layers are mocked.
 */

import {
  clearCacheForUser,
  clearQueuedPrefs,
  enqueueOp,
  flushPendingOps,
  getPendingOps,
  pendingOpCount,
  readCache,
  writeCache,
} from '@/db/offline';

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

jest.mock('@/db/queries', () => ({
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
const USER = 'user-1';

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  queue.length = 0;
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
    await enqueueOp(USER, 'add', { name: 'Netflix' });
    await enqueueOp(USER, 'edit', { id: 'x', patch: { amount: '9.99' } });
    await enqueueOp('other', 'add', { name: 'Spotify' });

    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['add', 'edit']);
    expect(ops[0]?.createdAt).toBeLessThanOrEqual(ops[1]!.createdAt);
    expect(await pendingOpCount(USER)).toBe(2);
  });
});

describe('flush', () => {
  it('replays ops in order and empties the queue on success', async () => {
    await enqueueOp(USER, 'add', { name: 'Netflix', amount: '15.99' });
    await enqueueOp(USER, 'edit', { id: 'x', patch: { amount: '17.99' } });
    await enqueueOp(USER, 'archive', { id: 'y', archived: true });
    await enqueueOp(USER, 'prefs', { currency: 'EUR', budget: 100, reminders_enabled: true, updated_at: 1 });

    const result = await flushPendingOps(USER);

    expect(result).toEqual({ applied: 4, failed: 0, error: null });
    expect(queries.insertSubscription).toHaveBeenCalledWith({ name: 'Netflix', amount: '15.99' });
    expect(queries.updateSubscription).toHaveBeenCalledWith('x', { amount: '17.99' });
    expect(queries.setArchived).toHaveBeenCalledWith('y', true);
    expect(await pendingOpCount(USER)).toBe(0);
  });

  it('halts on the first failure and keeps the op with attempts/error', async () => {
    queries.updateSubscription.mockRejectedValueOnce(new Error('RLS blocked'));
    await enqueueOp(USER, 'add', { name: 'Netflix' });
    await enqueueOp(USER, 'edit', { id: 'x', patch: {} });

    const result = await flushPendingOps(USER);

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
    const result = await flushPendingOps(USER);
    expect(result).toEqual({ applied: 0, failed: 0, error: null });
    jest.requireMock('@/lib/supabase').isSupabaseConfigured = true;
  });
});

describe('prefs coalescing', () => {
  it('removes only queued prefs ops', async () => {
    await enqueueOp(USER, 'prefs', { currency: 'EUR' });
    await enqueueOp(USER, 'add', { name: 'Netflix' });
    await clearQueuedPrefs(USER);

    const ops = await getPendingOps(USER);
    expect(ops.map((o) => o.type)).toEqual(['add']);
  });
});
