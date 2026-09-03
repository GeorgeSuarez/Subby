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

/** Quiet Ledger — dark palette: warm ink lineage of paper (light is hero). */
export const darkPalette: Palette = {
  // Surfaces — warm ink
  surface: '#0F1113',
  surfaceElevated: '#1A1E20',
  surfaceHigher: '#23282B',
  surfaceOverlay: 'rgba(15, 17, 19, 0.72)',

  // Borders
  border: '#2A3033',
  borderSubtle: '#1E2326',

  // Text — warm paper on ink
  textPrimary: '#F5F1EB',
  textSecondary: '#A8A29E',
  textTertiary: '#78716C',
  textOnAccent: '#FFFFFF',

  // Accent — deep ink-teal (trust over neon)
  accent: '#22A0BF',
  accentMuted: '#0E4A5C',
  accentSoft: 'rgba(34, 160, 191, 0.12)',
  accentSoftStrong: 'rgba(34, 160, 191, 0.20)',

  // Semantic — desaturated for paper calm
  positive: '#2FB88A',
  positiveSoft: 'rgba(47, 184, 138, 0.14)',
  negative: '#F07178',
  negativeSoft: 'rgba(240, 113, 120, 0.14)',
  warning: '#E8A838',
  warningSoft: 'rgba(232, 168, 56, 0.14)',

  // Misc
  scrim: 'rgba(0, 0, 0, 0.60)',
  hairline: 'rgba(245, 241, 235, 0.06)',
} as const;

/** Quiet Ledger — light palette: warm paper hero. */
export const lightPalette: Palette = {
  surface: '#FDFCF9',
  surfaceElevated: '#FFFFFF',
  surfaceHigher: '#FFFFFF',
  surfaceOverlay: 'rgba(253, 252, 249, 0.84)',

  border: '#E8E2D9',
  borderSubtle: '#F0EBE3',

  textPrimary: '#1C1A17',
  textSecondary: '#78716C',
  textTertiary: '#A8A29E',
  textOnAccent: '#FFFFFF',

  accent: '#0E4A5C',
  accentMuted: '#15566B',
  accentSoft: 'rgba(14, 74, 92, 0.08)',
  accentSoftStrong: 'rgba(14, 74, 92, 0.14)',

  positive: '#0D7A5A',
  positiveSoft: 'rgba(13, 122, 90, 0.10)',
  negative: '#BE123C',
  negativeSoft: 'rgba(190, 18, 60, 0.08)',
  warning: '#92400E',
  warningSoft: 'rgba(146, 64, 14, 0.08)',

  scrim: 'rgba(28, 26, 23, 0.40)',
  hairline: 'rgba(28, 26, 23, 0.06)',
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

/** Display font — Quiet Ledger serif for display/stat/title only. Body/caption stay system. */
export const fontFamily = {
  display: 'Fraunces-Regular',
  displaySemibold: 'Fraunces-SemiBold',
  system: 'System',
} as const;

export type FontFamily = (typeof fontFamily)[keyof typeof fontFamily];

/** Font weights (system + serif). */
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
  sm: '0 1px 2px rgba(0, 0, 0, 0.28)',
  md: '0 4px 12px rgba(0, 0, 0, 0.32)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.38)',
  xl: '0 18px 48px rgba(0, 0, 0, 0.46)',
  glowAccent: '0 0 16px rgba(34, 160, 191, 0.22)',
  glowPositive: '0 0 14px rgba(47, 184, 138, 0.20)',
} as const;

export const lightShadows = {
  sm: '0 1px 2px rgba(28, 26, 23, 0.06)',
  md: '0 4px 12px rgba(28, 26, 23, 0.07)',
  lg: '0 8px 24px rgba(28, 26, 23, 0.08)',
  xl: '0 18px 48px rgba(28, 26, 23, 0.10)',
  glowAccent: '0 0 14px rgba(14, 74, 92, 0.18)',
  glowPositive: '0 0 14px rgba(13, 122, 90, 0.16)',
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

/** Animation presets — quieter for Quiet Ledger (less bounce, faster). */
export const motion = {
  timingFast: 100,
  timingBase: 160,
  timingSlow: 280,
  spring: { damping: 18, stiffness: 200, mass: 0.9 },
} as const;
