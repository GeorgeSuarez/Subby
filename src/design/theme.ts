/**
 * Theme store + React hooks.
 *
 * Holds only the user's theme preference: `'system' | 'light' | 'dark'`.
 * The active palette is **derived** from the preference + system color scheme
 * via `useTheme()` — never stored in `useEffect`-synced state.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: storing just the preference; everything else derived.
 *  - `react-state-fallback`: `undefined` initial = "user hasn't chosen yet",
 *    falling back to the system color scheme.
 *  - `react-state-dispatcher`: setters update via dispatch.
 *  - Zustand selectors only (no React Context for shared app state).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useColorScheme } from 'react-native';

import { type Palette } from '@/design/tokens';
import {
  buildTheme,
  normalizeSystem,
  resolveScheme,
  type ResolvedScheme,
  type ThemePreference,
} from '@/design/theme-resolve';
import { persistentStorage, storageKey } from '@/design/storage';

interface ThemeStore {
  /** User's explicit choice. `undefined` => "hasn't chosen" → falls back to system. */
  preference: ThemePreference | undefined;
  setPreference: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      // `undefined` so the store can fall back to 'system' per skill rule `react-state-fallback`.
      preference: undefined,
      setPreference: (pref) => set({ preference: pref }),
    }),
    {
      name: storageKey.themePref,
      storage: createJSONStorage(() => persistentStorage),
      // Only persist the user's choice, never anything else.
      partialize: (s): { preference: ThemePreference | undefined } => ({ preference: s.preference }),
    },
  ),
);

/**
 * Resolve the active scheme by combining the persisted preference with the
 * device's current color scheme.
 */
function useResolvedScheme(): ResolvedScheme {
  // `useColorScheme` can return 'light' | 'dark' | 'unspecified' | null | undefined.
  const system = normalizeSystem(useColorScheme());
  // Subscribe to preference only — re-renders are scoped to manual toggles.
  const preference = useThemeStore((s) => s.preference);
  return resolveScheme(preference, system);
}

/**
 * Subscribe to the fully resolved theme.
 *
 * Usage:
 *   const { colors, scheme } = useTheme();
 *   const surface = colors.surface;
 *
 * For fine-grained selectors that only re-render when a specific color changes
 * (e.g. inside a memoized list row), prefer `useThemeColor` instead.
 */
export function useTheme() {
  const scheme = useResolvedScheme();
  return buildTheme(scheme);
}

/**
 * Selector hook for a single color. Re-renders only when that color's value
 * actually changes (because it's a primitive string), per skill rule
 * `react-state-minimize`.
 *
 *   const surface = useThemeColor('surface');
 */
export function useThemeColor(name: keyof Palette): string {
  const theme = useTheme();
  return theme.colors[name];
}

/** Selector for the resolved scheme alone ('light' | 'dark'). */
export function useColorMode(): ResolvedScheme {
  return useResolvedScheme();
}