/**
 * Pure theme resolution logic.
 *
 * This module has ZERO React / React Native imports so it is fully testable
 * in a plain Node Jest environment and reusable from native widgets or any
 * non-React context.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: storing just a preference; everything else derived.
 *  - `react-state-fallback`: `undefined` initial = "user hasn't chosen yet",
 *    falling back to the system color scheme (dark-first when ambiguous).
 */

import {
  darkPalette,
  darkShadows,
  lightPalette,
  lightShadows,
  type Palette,
  type ShadowScale,
  type ShadowValue,
} from '@/design/tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ResolvedScheme = 'light' | 'dark';

/** Color scheme values RN reports (may also be `null`/`undefined` at runtime). */
export type SystemScheme = 'light' | 'dark' | 'unspecified' | null | undefined;

/** Full resolved theme handed to components via `useTheme()`. */
export interface ResolvedTheme {
  scheme: ResolvedScheme;
  colors: Palette;
  shadow: (name: ShadowScale) => ShadowValue;
}

/** Default preference used until the user explicitly chooses a theme. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system';

/** Normalize RN's color scheme (which can be `'unspecified'` / null / undefined) into light/dark/null. */
export function normalizeSystem(scheme: SystemScheme): 'light' | 'dark' | null {
  if (scheme === 'light' || scheme === 'dark') return scheme;
  return null;
}

export function resolveScheme(
  pref: ThemePreference | undefined,
  system: 'light' | 'dark' | null,
): ResolvedScheme {
  const effective = pref ?? DEFAULT_PREFERENCE;
  if (effective === 'system') {
    // Quiet Ledger — light-first: warm paper is the hero when system is unknown.
    return system === 'dark' ? 'dark' : 'light';
  }
  return effective;
}

export function buildTheme(scheme: ResolvedScheme): ResolvedTheme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkPalette : lightPalette,
    shadow: (name) => (scheme === 'dark' ? darkShadows : lightShadows)[name],
  };
}

/** Imperative resolver for cases outside React (utilities, tests, widgets). */
export function resolveTheme(
  pref: ThemePreference | undefined,
  system: SystemScheme,
): ResolvedTheme {
  return buildTheme(resolveScheme(pref, normalizeSystem(system)));
}
