/**
 * UI store — user preferences across launches.
 *
 * Split ownership:
 *  - Account-level prefs (`currency`, `budget`, `remindersEnabled`) live in
 *    Supabase `user_prefs` (RLS-scoped). Setters update local state
 *    immediately and sync to the server best-effort; `hydratePrefs()` loads
 *    them when the signed-in account changes and resets to defaults on
 *    sign-out.
 *  - Device-level prefs (`sort`, `filter`) stay in the SQLite-backed
 *    `persistentStorage` adapter, so they survive restarts.
 *
 * The theme preference lives in `@/design/theme.ts` (`useThemeStore`) since it
 * is tied to the palette resolver.
 */

import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { persistentStorage } from '@/design/storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { DEFAULT_CURRENCY } from '@/utils/constants';
import type { CurrencyCode, SubscriptionFilter, SubscriptionSort } from '@/types/subscription';

const UI_PREFS_KEY = Platform.OS === 'ios' ? 'subby.ios.uiPrefs' : 'subby.uiPrefs';

/** Defaults for account-level prefs (also the user_prefs column defaults). */
const ACCOUNT_PREF_DEFAULTS = {
  currency: DEFAULT_CURRENCY,
  budget: 0,
  remindersEnabled: true,
} as const;

export interface UIStore {
  currency: CurrencyCode;
  sort: SubscriptionSort;
  filter: SubscriptionFilter;
  /** Monthly budget in major currency units. 0 = not set. */
  budget: number;
  /** Schedule local renewal-reminder notifications. */
  remindersEnabled: boolean;
  setCurrency: (c: CurrencyCode) => void;
  setSort: (s: SubscriptionSort) => void;
  setFilter: (f: SubscriptionFilter) => void;
  setBudget: (b: number) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  /** Load account prefs from Supabase; reset to defaults when signed out. */
  hydratePrefs: () => Promise<void>;
}

/** Sync account prefs to Supabase (best-effort upsert, errors swallowed). */
async function syncAccountPrefs(
  prefs: { currency: CurrencyCode; budget: number; remindersEnabled: boolean },
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('user_prefs').upsert(
    {
      currency: prefs.currency,
      budget: prefs.budget,
      reminders_enabled: prefs.remindersEnabled,
      updated_at: Date.now(),
    },
    { onConflict: 'user_id' },
  );
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      ...ACCOUNT_PREF_DEFAULTS,
      sort: 'nextRenewal',
      filter: 'active',

      setCurrency: (currency) => {
        set({ currency });
        void syncAccountPrefs({ ...get(), currency });
      },
      setSort: (sort) => set({ sort }),
      setFilter: (filter) => set({ filter }),
      setBudget: (budget) => {
        set({ budget });
        void syncAccountPrefs({ ...get(), budget });
      },
      setRemindersEnabled: (remindersEnabled) => {
        set({ remindersEnabled });
        void syncAccountPrefs({ ...get(), remindersEnabled });
      },

      hydratePrefs: async () => {
        if (!isSupabaseConfigured) return;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // Signed out — no account prefs apply.
          set({ ...ACCOUNT_PREF_DEFAULTS });
          return;
        }
        const { data: prefs } = await supabase
          .from('user_prefs')
          .select('currency, budget, reminders_enabled')
          .eq('user_id', data.session.user.id)
          .maybeSingle();
        if (!prefs) {
          // First sign-in (or never touched): defaults; the row is created on
          // the first write.
          set({ ...ACCOUNT_PREF_DEFAULTS });
          return;
        }
        set({
          currency: prefs.currency as CurrencyCode,
          budget: Number(prefs.budget),
          remindersEnabled: prefs.reminders_enabled,
        });
      },
    }),
    {
      name: UI_PREFS_KEY,
      storage: createJSONStorage(() => persistentStorage),
      // Only device-level prefs persist locally — account prefs come from
      // Supabase.
      partialize: (s): { sort: SubscriptionSort; filter: SubscriptionFilter } => ({
        sort: s.sort,
        filter: s.filter,
      }),
    },
  ),
);

// Selectors — fine-grained for skill `react-state-minimize`.
export function useCurrency(): CurrencyCode {
  return useUIStore((s) => s.currency);
}
export function useSort(): SubscriptionSort {
  return useUIStore((s) => s.sort);
}
export function useFilter(): SubscriptionFilter {
  return useUIStore((s) => s.filter);
}
/** Monthly budget in major units; 0 when unset. */
export function useBudget(): number {
  return useUIStore((s) => s.budget);
}

/** Are renewal reminders enabled? */
export function useRemindersEnabled(): boolean {
  return useUIStore((s) => s.remindersEnabled);
}
