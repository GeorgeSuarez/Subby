/**
 * Subscriptions store.
 *
 * Single Zustand store that mirrors the SQLite subscriptions table. The DB is
 * the source of truth — this store is just a read-through cache that re-fetches
 * after each mutation so React components subscribe to updates.
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
  updateSubscription as dbUpdate,
} from '@/db/queries';
import type {
  Subscription,
  SubscriptionDraft,
  SubscriptionPatch,
} from '@/types/subscription';
import { useAuthStore } from '@/store/useAuthStore';
import { isTestAccountEmail } from '@/utils/constants';

/**
 * Demo (seeded) rows are visible ONLY to the test account. Every read of the
 * subscriptions table passes this flag so the DB stays device-wide while each
 * account only ever sees its own view.
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
  /** Pull every row from the DB into the store (account-aware visibility). */
  hydrate: () => Promise<void>;
  /**
   * Drop the in-memory cache without touching the DB. Called when the signed-in
   * account changes so a previous account's rows are never visible — even
   * briefly or after a failed read.
   */
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
}

export const useSubscriptionsStore = create<SubscriptionsStore>((set, get) => ({
  subs: [],
  isLoading: false,
  error: null,

  resetCache: () => set({ subs: [], error: null }),

  hydrate: async () => {
    set({ isLoading: true, error: null });
    try {
      // No auto-seed: demo (seeded) data is loaded only by the test account
      // via `loadSeedData` (see `src/db/seed.ts`).
      const subs = await getAllSubscriptions(seededVisibility());
      set({ subs, isLoading: false });
    } catch (e) {
      // Never leave a stale/previous account's rows visible on failure —
      // empty beats wrong.
      set({ isLoading: false, error: errorMessage(e), subs: [] });
    }
  },

  add: async (draft) => {
    try {
      const created = await dbInsert(draft);
      // Refresh cache from DB rather than mutating locally (single source of truth).
      const subs = await getAllSubscriptions(seededVisibility());
      set({ subs, error: null });
      return created;
    } catch (e) {
      set({ error: errorMessage(e) });
      return null;
    }
  },

  edit: async (id, patch) => {
    try {
      const updated = await dbUpdate(id, patch);
      if (!updated) {
        set({ error: `Subscription ${id} not found` });
        return null;
      }
      const subs = await getAllSubscriptions(seededVisibility());
      set({ subs, error: null });
      return updated;
    } catch (e) {
      set({ error: errorMessage(e) });
      return null;
    }
  },

  archive: async (id, archived) => {
    try {
      const updated = await dbSetArchived(id, archived);
      if (!updated) {
        set({ error: `Subscription ${id} not found` });
        return null;
      }
      const subs = await getAllSubscriptions(seededVisibility());
      set({ subs, error: null });
      return updated;
    } catch (e) {
      set({ error: errorMessage(e) });
      return null;
    }
  },

  remove: async (id) => {
    try {
      await dbDelete(id);
      const subs = await getAllSubscriptions(seededVisibility());
      set({ subs, error: null });
    } catch (e) {
      set({ error: errorMessage(e) });
    }
  },

  clearAll: async () => {
    try {
      await deleteAllSubscriptions();
      set({ subs: [], error: null });
    } catch (e) {
      set({ error: errorMessage(e) });
    }
  },

  getById: (id) => get().subs.find((s) => s.id === id),
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

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Unknown error';
}