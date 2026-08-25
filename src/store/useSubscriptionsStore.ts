/**
 * Subscriptions store.
 *
 * Zustand store that mirrors the Supabase subscriptions table. It is a thin
 * front-end over the sync coordinator (`db/offline.ts`): every mutation
 * funnels through `applyMutation`, which owns reachability, queueing,
 * notification side-effects, cache writes, re-reads, and error
 * classification. The store owns state and the coordinator owns behaviour.
 *
 * Offline, reads serve the last-synced cache and mutations are enqueued
 * (queue-invisible: local state only ever holds synced rows), flushed in
 * FIFO order on reconnect.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: no derived state is stored. Aggregates (totals,
 *    upcoming renewals, biggest) are computed during render from `subs`.
 *  - `react-state-dispatcher`: every mutator goes through the coordinator then
 *    applies the fresh re-read; we never locally mutate the array.
 *  - Zustand selectors used by components so list rows re-render only when
 *    their slice of state changes.
 *  - No React Context (skill `react-state-minimize`).
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { getAllSubscriptions } from '@/db/queries';
import {
  applyMutation,
  flushPendingOps,
  isNetworkError,
  pendingOpCount,
  readCache,
  writeCache,
  type MutateResult,
  type SyncContext,
} from '@/db/offline';
import { getNetworkReachability } from '@/db/network';
import { SESSION_EXPIRED_MESSAGE } from '@/lib/session-errors';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { isTestAccountEmail } from '@/utils/constants';
import type {
  Subscription,
  SubscriptionDraft,
  SubscriptionPatch,
} from '@/types/subscription';

/**
 * Demo (seeded) rows are visible ONLY to the test account. Every read of the
 * subscriptions table passes this flag so each account only ever sees its own
 * rows (RLS) plus, for the test account, its demo data.
 */
function seededVisibility(): boolean {
  return isTestAccountEmail(useAuthStore.getState().email);
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

type Set = (partial: Partial<SubscriptionsStore>) => void;

async function currentUserId(): Promise<string | null> {
  return useAuthStore.getState().userId;
}

async function refreshPendingCount(set: Set): Promise<void> {
  const userId = await currentUserId();
  const count = userId ? await pendingOpCount(userId) : 0;
  set({ pendingCount: count });
}

/** Build the coordinator context from the current session + UI state. */
function syncContext(): SyncContext | null {
  const userId = useAuthStore.getState().userId;
  if (!userId) return null;
  return {
    userId,
    includeSeeded: seededVisibility(),
    remindersEnabled: useUIStore.getState().remindersEnabled,
  };
}

/**
 * Apply a coordinator result to store state. `notFoundId` marks ops where a
 * `null` row on a synced result means "row missing" (edit/archive) rather
 * than "nothing to return" (remove/clear_all).
 */
function applyResult(
  set: Set,
  get: () => SubscriptionsStore,
  result: MutateResult,
  notFoundId?: string,
): Subscription | null {
  switch (result.status) {
    case 'synced': {
      if (result.row === null && notFoundId) {
        set({ error: `Subscription ${notFoundId} not found` });
        return null;
      }
      set({ subs: result.subs ?? get().subs, error: null });
      void refreshPendingCount(set);
      return result.row;
    }
    case 'queued':
      set({ queuedChange: true, syncError: null });
      void refreshPendingCount(set);
      return null;
    case 'session-expired':
      void useAuthStore.getState().expireSession(SESSION_EXPIRED_MESSAGE);
      return null;
    case 'error':
      set({ error: result.message });
      return null;
  }
}

export const useSubscriptionsStore = create<SubscriptionsStore>()(
  (set, get) => ({
    subs: [],
    isLoading: false,
    error: null,
    isOffline: false,
    pendingCount: 0,
    syncError: null,
    queuedChange: false,

    resetCache: () => set({ subs: [], error: null }),

    setNetworkState: (reachable) => {
      set({
        isOffline: reachable === false,
        syncError: reachable === false ? null : get().syncError,
      });
    },

    // ponytail: offline-hydrate dance (reachability → cache → fetch →
    // write-back) is hand-rolled here, in useEntitlementStore.hydrate, and in
    // useUIStore; extract one shared helper when a 4th consumer appears or
    // these branches stop diverging.
    hydrate: async () => {
      set({ isLoading: true, error: null });
      const userId = await currentUserId();
      const includeSeeded = seededVisibility();
      try {
        const reachable = await getNetworkReachability();
        if (reachable === false) {
          // Offline — serve the last-synced snapshot.
          const cached = userId
            ? await readCache<Subscription[]>('subs', userId)
            : null;
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
        const failure = e instanceof Error ? e : new Error(String(e));
        set({ isLoading: false, error: failure.message, subs: [] });
        if (/session|jwt|foreign key/i.test(failure.message)) {
          void useAuthStore.getState().expireSession(SESSION_EXPIRED_MESSAGE);
          return;
        }
        if (isNetworkError(failure) && userId) {
          const cached = await readCache<Subscription[]>('subs', userId);
          set({ subs: cached ?? [], isOffline: true });
        }
      }
    },

    add: async (draft) => {
      const ctx = syncContext();
      if (!ctx) return null;
      const result = await applyMutation({ type: 'add', draft }, ctx);
      return applyResult(set, get, result);
    },

    edit: async (id, patch) => {
      const ctx = syncContext();
      if (!ctx) return null;
      const result = await applyMutation({ type: 'edit', id, patch }, ctx);
      return applyResult(set, get, result, id);
    },

    archive: async (id, archived) => {
      const ctx = syncContext();
      if (!ctx) return null;
      const result = await applyMutation(
        { type: 'archive', id, archived },
        ctx,
      );
      return applyResult(set, get, result, id);
    },

    remove: async (id) => {
      const ctx = syncContext();
      if (!ctx) return;
      const result = await applyMutation({ type: 'remove', id }, ctx);
      applyResult(set, get, result);
    },

    clearAll: async () => {
      const ctx = syncContext();
      if (!ctx) return;
      const result = await applyMutation(
        { type: 'clear_all', cleared: true },
        ctx,
      );
      applyResult(set, get, result);
    },

    getById: (id) => get().subs.find((s) => s.id === id),

    flushPending: async () => {
      const userId = await currentUserId();
      if (!userId) return;
      try {
        const result = await flushPendingOps(userId, {
          includeSeeded: seededVisibility(),
          remindersEnabled: useUIStore.getState().remindersEnabled,
        });
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
        set({ syncError: e instanceof Error ? e.message : String(e) });
      }
    },
  }),
);

// --- Selectors (skill `react-state-minimize`) ------------------------------

/** All active (non-archived) subscriptions. Use inside components. */
export function useActiveSubscriptions(): Subscription[] {
  return useSubscriptionsStore(
    useShallow((s) => s.subs.filter((x) => !x.archived)),
  );
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
