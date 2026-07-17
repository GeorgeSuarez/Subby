/**
 * Subby design tokens.
 *
 * Single source of truth for all visual constants. The active palette is
 * resolved at runtime via `useTheme()` in `./theme.ts` based on the user's
 * theme preference (system / light / dark).
 *
 * Skill rules followed:
 *  - `ui-styling`: tokens consumed by `StyleSheet.create` only; no inline objects.
 *  - limited type scale; hierarchy comes from weight/color, not dozens of sizes.
 *  - shadows expressed as CSS `box-shadow` string syntax.
 *  - `borderCurve: 'continuous'` is applied by components alongside `radius.*`.
 */

export type ColorToken = string;

/**
 * A palette shape. Element types are widened to `string` so both `darkPalette`
 * and `lightPalette` (which have distinct literal values) are assignable.
 */
export type Palette = {
  surface: string;
  surfaceElevated: string;
  surfaceHigher: string;
  surfaceOverlay: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;
  accent: string;
  accentMuted: string;
  accentSoft: string;
  accentSoftStrong: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  scrim: string;
  hairline: string;
};

export type ColorName = keyof Palette;

/** Brand palette: the dark-first "cool + cyan" identity. */
export const darkPalette: Palette = {
  // Surfaces — cool, slightly blue-tinted blacks
  surface: '#0B0F14',
  surfaceElevated: '#131920',
  surfaceHigher: '#1B232E',
  surfaceOverlay: 'rgba(11, 15, 20, 0.72)',

  // Borders
  border: '#1F2A36',
  borderSubtle: '#16202B',

  // Text
  textPrimary: '#F4F7FB',
  textSecondary: '#93A1B5',
  textTertiary: '#5E6B7E',
  textOnAccent: '#03110F',

  // Accent — electric cyan
  accent: '#22D3EE',
  accentMuted: '#0E7490',
  accentSoft: 'rgba(34, 211, 238, 0.12)',
  accentSoftStrong: 'rgba(34, 211, 238, 0.22)',

  // Semantic
  positive: '#34D399',
  positiveSoft: 'rgba(52, 211, 153, 0.14)',
  negative: '#F87171',
  negativeSoft: 'rgba(248, 113, 113, 0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',

  // Misc
  scrim: 'rgba(0, 0, 0, 0.6)',
  hairline: 'rgba(255, 255, 255, 0.06)',
} as const;

/** Light palette: shares names with `darkPalette` for easy swapping. */
export const lightPalette: Palette = {
  surface: '#F7F9FC',
  surfaceElevated: '#FFFFFF',
  surfaceHigher: '#FFFFFF',
  surfaceOverlay: 'rgba(255, 255, 255, 0.84)',

  border: '#E5E9EF',
  borderSubtle: '#EEF1F6',

  textPrimary: '#0B0F14',
  textSecondary: '#5E6B7E',
  textTertiary: '#93A1B5',
  textOnAccent: '#FFFFFF',

  accent: '#0891B2',
  accentMuted: '#0E7490',
  accentSoft: 'rgba(8, 145, 178, 0.08)',
  accentSoftStrong: 'rgba(8, 145, 178, 0.16)',

  positive: '#059669',
  positiveSoft: 'rgba(5, 150, 105, 0.10)',
  negative: '#DC2626',
  negativeSoft: 'rgba(220, 38, 38, 0.10)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.10)',

  scrim: 'rgba(11, 15, 20, 0.48)',
  hairline: 'rgba(11, 15, 20, 0.06)',
} as const;

/** Spacing scale (in dp). */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export type Spacing = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[Spacing];

/** Corner radii. Pair with `borderCurve: 'continuous'`. */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type Radius = keyof typeof radius;
export type RadiusValue = (typeof radius)[Radius];

/**
 * Type scale — intentionally small.
 * Vary `fontWeight` and color for hierarchy, not `fontSize`.
 */
export const typeScale = {
  /** Hero numbers (monthly total, headline stats). */
  display: 34,
  /** Screen titles, large headings. */
  title: 22,
  /** Section headings, prominent rows. */
  headline: 18,
  /** Default body copy, list rows. */
  body: 16,
  /** Captions, meta, chip labels. */
  caption: 13,
  /** Oversized stat numerals (used sparingly). */
  stat: 44,
} as const;

export type TypeScale = keyof typeof typeScale;
export type TypeSize = (typeof typeScale)[TypeScale];

/** Font weights (system font, no custom fonts for v1). */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

/** Line heights paired with the type scale. */
export const lineHeight = {
  display: 40,
  title: 28,
  headline: 24,
  body: 22,
  caption: 18,
  stat: 50,
} as const;

/**
 * Shadows as CSS `box-shadow` strings.
 * Skill rule `ui-styling`: prefer CSS syntax over legacy `shadowColor`/`elevation`.
 * Dark theme shadows use pure black; light theme shadows are subtler.
 */
export const darkShadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.24)',
  md: '0 4px 12px rgba(0, 0, 0, 0.36)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.44)',
  xl: '0 18px 48px rgba(0, 0, 0, 0.52)',
  glowAccent: '0 0 20px rgba(34, 211, 238, 0.35)',
  glowPositive: '0 0 16px rgba(52, 211, 153, 0.28)',
} as const;

export const lightShadows = {
  sm: '0 1px 2px rgba(11, 15, 20, 0.06)',
  md: '0 4px 12px rgba(11, 15, 20, 0.08)',
  lg: '0 8px 24px rgba(11, 15, 20, 0.10)',
  xl: '0 18px 48px rgba(11, 15, 20, 0.12)',
  glowAccent: '0 0 16px rgba(8, 145, 178, 0.28)',
  glowPositive: '0 0 16px rgba(5, 150, 105, 0.22)',
} as const;

/** Names of shadow presets shared by both `darkShadows` and `lightShadows`. */
export type ShadowScale = keyof typeof darkShadows;
/** Shadow preset value — widened to `string` so both palettes are assignable. */
export type ShadowValue = string;

/** Layout-level constants. */
export const layout = {
  /** Max content width for tablet/large screens. */
  maxContentWidth: 760,
  /** Horizontal screen padding for full-bleed scroll views. */
  screenPaddingH: spacing.lg,
  /** Card corner radius. */
  cardRadius: radius.lg,
  /** Row height for a single-line list row (for FlashList `estimatedItemSize`). */
  rowHeight: 64,
  /** FAB diameter. */
  fabSize: 56,
} as const;

/** Animation presets (used with Reanimated `withTiming`/`withSpring`). */
export const motion = {
  timingFast: 120,
  timingBase: 200,
  timingSlow: 320,
  spring: { damping: 14, stiffness: 180, mass: 0.9 },
} as const;