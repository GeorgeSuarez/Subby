/**
 * UI store — user preferences persisted across launches.
 *
 * Stored values:
 *  - `currency`     — default currency for new subscriptions (Settings).
 *  - `sort`         — current sort for the subscriptions list.
 *  - `filter`       — current filter for the subscriptions list.
 *  - `budget`       — monthly budget for the dashboard hero (0 = unset).
 *
 * The theme preference lives in `@/design/theme.ts` (`useThemeStore`) since it
 * is tied to the palette resolver. Currency/sort/filter are independent.
 *
 * Persistence uses the SQLite-backed `persistentStorage` adapter
 * (`@/design/storage`), so preferences survive restarts.
 */

import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { persistentStorage } from '@/design/storage';
import { DEFAULT_CURRENCY } from '@/utils/constants';
import type { CurrencyCode, SubscriptionFilter, SubscriptionSort } from '@/types/subscription';

const UI_PREFS_KEY = Platform.OS === 'ios' ? 'subby.ios.uiPrefs' : 'subby.uiPrefs';

export interface UIStore {
  currency: CurrencyCode;
  sort: SubscriptionSort;
  filter: SubscriptionFilter;
  /** Monthly budget in major currency units. 0 = not set. */
  budget: number;
  setCurrency: (c: CurrencyCode) => void;
  setSort: (s: SubscriptionSort) => void;
  setFilter: (f: SubscriptionFilter) => void;
  setBudget: (b: number) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      currency: DEFAULT_CURRENCY,
      sort: 'nextRenewal',
      filter: 'active',
      budget: 0,
      setCurrency: (currency) => set({ currency }),
      setSort: (sort) => set({ sort }),
      setFilter: (filter) => set({ filter }),
      setBudget: (budget) => set({ budget }),
    }),
    {
      name: UI_PREFS_KEY,
      storage: createJSONStorage(() => persistentStorage),
      partialize: (s): { currency: CurrencyCode; sort: SubscriptionSort; filter: SubscriptionFilter; budget: number } => ({
        currency: s.currency,
        sort: s.sort,
        filter: s.filter,
        budget: s.budget,
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