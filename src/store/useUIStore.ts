/**
 * UI store — user preferences persisted across launches.
 *
 * Stored values:
 *  - `currency`     — default currency for new subscriptions (Settings).
 *  - `sort`         — current sort for the subscriptions list.
 *  - `filter`       — current filter for the subscriptions list.
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
  setCurrency: (c: CurrencyCode) => void;
  setSort: (s: SubscriptionSort) => void;
  setFilter: (f: SubscriptionFilter) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      currency: DEFAULT_CURRENCY,
      sort: 'nextRenewal',
      filter: 'active',
      setCurrency: (currency) => set({ currency }),
      setSort: (sort) => set({ sort }),
      setFilter: (filter) => set({ filter }),
    }),
    {
      name: UI_PREFS_KEY,
      storage: createJSONStorage(() => persistentStorage),
      partialize: (s): { currency: CurrencyCode; sort: SubscriptionSort; filter: SubscriptionFilter } => ({
        currency: s.currency,
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