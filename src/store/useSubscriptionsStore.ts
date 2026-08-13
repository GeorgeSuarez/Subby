/**
 * Subscriptions store.
 *
 * Zustand store that mirrors the Supabase subscriptions table. Online, the
 * server is the source of truth — the store re-fetches after each mutation so
 * React components subscribe to updates. Offline, reads serve the last-synced
 * cache (`db/offline.ts`) and mutations are enqueued (queue-invisible: local
 * state only ever holds synced rows), flushed in FIFO order on reconnect.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: no derived state is stored. Aggregates (totals,
 *    upcoming renewals, biggest) are computed during render from `subs`.
 *  - `react-state-dispatcher`: every mutator calls the DB then re-reads;
 *    we never locally mutate the array (avoids stale-cache bugs).
 *  - Zustand selectors used by components so list rows re-render only when
 *    their slice of state changes.
 *  - No React Context (skill `react-state-minimize`).
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import {
  deleteAllSubscriptions,
  deleteSubscription as dbDelete,
  getAllSubscriptions,
  insertSubscription as dbInsert,
  setArchived as dbSetArchived,
  setNotificationId as dbSetNotificationId,
  updateSubscription as dbUpdate,
} from '@/db/queries';
import {
  enqueueOp,
  flushPendingOps,
  pendingOpCount,
  readCache,
  writeCache,
} from '@/db/offline';
import { getNetworkReachability } from '@/db/network';
import {
  cancelRenewalReminder,
  rescheduleRenewalReminder,
  scheduleRenewalReminder,
} from '@/utils/notifications';
import type {
  Subscription,
  SubscriptionDraft,
  SubscriptionPatch,
} from '@/types/subscription';
import { useAuthStore } from '@/store/useAuthStore';
import { isSessionExpiredError } from '@/lib/session-errors';
import { isTestAccountEmail } from '@/utils/constants';

/**
 * Demo (seeded) rows are visible ONLY to the test account. Every read of the
 * subscriptions table passes this flag so each account only ever sees its own
 * rows (RLS) plus, for the test account, its demo data.
 */
function seededVisibility(): boolean {
  return isTestAccountEmail(useAuthStore.getState().email);
}

/** True when a network error (rather than a server-side one) occurred. */
function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const message = e instanceof Error ? e.message : String(e);
  return /network request failed|fetch failed|temporarily unavailable/i.test(message);
}

export interface SubscriptionsStore {
  /** Currently cached subscriptions. Empty until `hydrate()` finishes. */
  subs: Subscription[];
  /** True while the initial DB read is running. */
  isLoading: boolean;
  /** Error from the last failed operation; cleared on next success. */
  error: string | null;
  /** True when the device reports no internet (reads served from cache). */
  isOffline: boolean;
  /** Number of queued (unsynced) writes for the signed-in user. */
  pendingCount: number;
  /** Last flush failure message, or null. */
  syncError: string | null;
  /** Set when a mutation was queued instead of applied (screens toast it). */
  queuedChange: boolean;
  /** Pull every row from the server (or cache when offline) into the store. */
  hydrate: () => Promise<void>;
  /** Drop the in-memory cache without touching the DB. */
  resetCache: () => void;
  /** Add a new subscription. Returns the persisted row on success. */
  add: (draft: SubscriptionDraft) => Promise<Subscription | null>;
  /** Patch fields on an existing subscription. Returns the updated row, or null. */
  edit: (id: string, patch: SubscriptionPatch) => Promise<Subscription | null>;
  /** Toggle (or explicitly set) the archived flag. */
  archive: (id: string, archived: boolean) => Promise<Subscription | null>;
  /** Permanently remove a subscription. */
  remove: (id: string) => Promise<void>;
  /** Wipe all rows. Used by Settings > Danger Zone. */
  clearAll: () => Promise<void>;
  /** Convenience reader — returns undefined if not loaded yet. */
  getById: (id: string) => Subscription | undefined;
  /** Replay queued writes (called on reconnect / manual retry). */
  flushPending: () => Promise<void>;
  /** Update connectivity state from the network listener. */
  setNetworkState: (reachable: boolean | null) => void;
}

async function currentUserId(): Promise<string | null> {
  return useAuthStore.getState().userId;
}

async function refreshPendingCount(set: (partial: Partial<SubscriptionsStore>) => void): Promise<void> {
  const userId = await currentUserId();
  const count = userId ? await pendingOpCount(userId) : 0;
  set({ pendingCount: count });
}

export const useSubscriptionsStore = create<SubscriptionsStore>()((set, get) => ({
  subs: [],
  isLoading: false,
  error: null,
  isOffline: false,
  pendingCount: 0,
  syncError: null,
  queuedChange: false,

  resetCache: () => set({ subs: [], error: null }),

  setNetworkState: (reachable) => {
    set({ isOffline: reachable === false, syncError: reachable === false ? null : get().syncError });
  },

  hydrate: async () => {
    set({ isLoading: true, error: null });
    const userId = await currentUserId();
    const includeSeeded = seededVisibility();
    try {
      const reachable = await getNetworkReachability();
      if (reachable === false) {
        // Offline — serve the last-synced snapshot.
        const cached = userId ? await readCache<Subscription[]>('subs', userId) : null;
        set({
          subs: cached ?? [],
          isLoading: false,
          isOffline: true,
          queuedChange: false,
        });
        return;
      }
      const subs = await getAllSubscriptions(includeSeeded);
      if (userId) await writeCache('subs', userId, subs);
      set({ subs, isLoading: false, isOffline: false, queuedChange: false });
      await refreshPendingCount(set);
    } catch (e) {
      // Never leave a stale/previous account's rows visible on failure —
      // empty beats wrong.
      set({ isLoading: false, error: errorMessage(e), subs: [] });
      if (isSessionExpiredError(e)) {
        void useAuthStore.getState().expireSession('Your session expired — please sign in again.');
        return;
      }
      if (isNetworkError(e) && userId) {
        const cached = await readCache<Subscription[]>('subs', userId);
        set({ subs: cached ?? [], isOffline: true });
      }
    }
  },

  add: async (draft) => {
    const userId = await currentUserId();
    if (!userId) return null;
    try {
      if ((await getNetworkReachability()) === false) {
        await enqueueOp(userId, 'add', { ...draft });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return null;
      }
      const created = await dbInsert(draft);
      // Schedule the renewal reminder and persist its id (best-effort — a
      // denied permission or disabled toggle just leaves it unscheduled).
      const notificationId = await scheduleRenewalReminder(created);
      if (notificationId) {
        await dbSetNotificationId(created.id, notificationId);
      }
      // Refresh cache from DB rather than mutating locally (single source of truth).
      const subs = await getAllSubscriptions(seededVisibility());
      if (userId) await writeCache('subs', userId, subs);
      set({ subs, error: null });
      await refreshPendingCount(set);
      return created;
    } catch (e) {
      if (isNetworkError(e) && userId) {
        await enqueueOp(userId, 'add', { ...draft });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return null;
      }
      if (isSessionExpiredError(e)) {
        void useAuthStore.getState().expireSession('Your session expired — please sign in again.');
        return null;
      }
      set({ error: errorMessage(e) });
      return null;
    }
  },

  edit: async (id, patch) => {
    const userId = await currentUserId();
    if (!userId) return null;
    try {
      if ((await getNetworkReachability()) === false) {
        await enqueueOp(userId, 'edit', { id, patch });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return null;
      }
      const previous = get().subs.find((x) => x.id === id);
      const updated = await dbUpdate(id, patch);
      if (!updated) {
        set({ error: `Subscription ${id} not found` });
        return null;
      }
      // Renewal date may have changed — reschedule the reminder.
      const notificationId = await rescheduleRenewalReminder(updated, previous?.notificationId);
      if (notificationId) {
        await dbSetNotificationId(updated.id, notificationId);
      }
      const subs = await getAllSubscriptions(seededVisibility());
      if (userId) await writeCache('subs', userId, subs);
      set({ subs, error: null });
      await refreshPendingCount(set);
      return updated;
    } catch (e) {
      if (isNetworkError(e) && userId) {
        await enqueueOp(userId, 'edit', { id, patch });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return null;
      }
      if (isSessionExpiredError(e)) {
        void useAuthStore.getState().expireSession('Your session expired — please sign in again.');
        return null;
      }
      set({ error: errorMessage(e) });
      return null;
    }
  },

  archive: async (id, archived) => {
    const userId = await currentUserId();
    if (!userId) return null;
    try {
      if ((await getNetworkReachability()) === false) {
        await enqueueOp(userId, 'archive', { id, archived });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return null;
      }
      const previous = get().subs.find((x) => x.id === id);
      const updated = await dbSetArchived(id, archived);
      if (!updated) {
        set({ error: `Subscription ${id} not found` });
        return null;
      }
      // Archived subs stop charging — drop their reminder.
      if (archived && previous?.notificationId) {
        await cancelRenewalReminder(previous.notificationId);
        await dbSetNotificationId(id, null);
      }
      const subs = await getAllSubscriptions(seededVisibility());
      if (userId) await writeCache('subs', userId, subs);
      set({ subs, error: null });
      await refreshPendingCount(set);
      return updated;
    } catch (e) {
      if (isNetworkError(e) && userId) {
        await enqueueOp(userId, 'archive', { id, archived });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return null;
      }
      if (isSessionExpiredError(e)) {
        void useAuthStore.getState().expireSession('Your session expired — please sign in again.');
        return null;
      }
      set({ error: errorMessage(e) });
      return null;
    }
  },

  remove: async (id) => {
    const userId = await currentUserId();
    if (!userId) return;
    try {
      if ((await getNetworkReachability()) === false) {
        await enqueueOp(userId, 'remove', { id });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return;
      }
      const target = get().subs.find((x) => x.id === id);
      if (target?.notificationId) {
        await cancelRenewalReminder(target.notificationId);
      }
      await dbDelete(id);
      const subs = await getAllSubscriptions(seededVisibility());
      if (userId) await writeCache('subs', userId, subs);
      set({ subs, error: null });
      await refreshPendingCount(set);
    } catch (e) {
      if (isNetworkError(e) && userId) {
        await enqueueOp(userId, 'remove', { id });
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return;
      }
      if (isSessionExpiredError(e)) {
        void useAuthStore.getState().expireSession('Your session expired — please sign in again.');
        return;
      }
      set({ error: errorMessage(e) });
    }
  },

  clearAll: async () => {
    const userId = await currentUserId();
    if (!userId) return;
    try {
      if ((await getNetworkReachability()) === false) {
        await enqueueOp(userId, 'clear_all', {});
        set({ queuedChange: true, syncError: null });
        await refreshPendingCount(set);
        return;
      }
      // Cancel every scheduled reminder before wiping rows.
      for (const s of get().subs) {
        await cancelRenewalReminder(s.notificationId);
      }
      await deleteAllSubscriptions();
      set({ subs: [], error: null });
      await refreshPendingCount(set);
    } catch (e) {
      if (isSessionExpiredError(e)) {
        void useAuthStore.getState().expireSession('Your session expired — please sign in again.');
        return;
      }
      set({ error: errorMessage(e) });
    }
  },

  getById: (id) => get().subs.find((s) => s.id === id),

  flushPending: async () => {
    const userId = await currentUserId();
    if (!userId) return;
    try {
      const result = await flushPendingOps(userId);
      if (result.applied > 0) {
        // Authoritative re-read after a clean flush.
        const subs = await getAllSubscriptions(seededVisibility());
        await writeCache('subs', userId, subs);
        set({ subs });
      }
      set({
        syncError: result.error,
        queuedChange: false,
        isOffline: false,
      });
      await refreshPendingCount(set);
    } catch (e) {
      set({ syncError: errorMessage(e) });
    }
  },
}));

// --- Selectors (skill `react-state-minimize`) ------------------------------

/** All active (non-archived) subscriptions. Use inside components. */
export function useActiveSubscriptions(): Subscription[] {
  return useSubscriptionsStore(useShallow((s) => s.subs.filter((x) => !x.archived)));
}

/** A single subscription by id (or undefined). Re-renders only when that row
 * changes. Returns undefined while the cache is loading. */
export function useSubscriptionById(id: string): Subscription | undefined {
  return useSubscriptionsStore((s) => s.subs.find((x) => x.id === id));
}

/** Boolean: true until the first hydrate completes. */
export function useIsLoadingSubscriptions(): boolean {
  return useSubscriptionsStore((s) => s.isLoading);
}

/** Last error message, or null. */
export function useSubscriptionsError(): string | null {
  return useSubscriptionsStore((s) => s.error);
}

/** True when the device is offline (reads are served from the cache). */
export function useIsOffline(): boolean {
  return useSubscriptionsStore((s) => s.isOffline);
}

/** Number of queued (unsynced) writes. */
export function usePendingCount(): number {
  return useSubscriptionsStore((s) => s.pendingCount);
}

/** Last flush failure message, or null. */
export function useSyncError(): string | null {
  return useSubscriptionsStore((s) => s.syncError);
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Unknown error';
}
