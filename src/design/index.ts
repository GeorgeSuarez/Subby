/**
 * Design system barrel.
 *
 * Components should import tokens and theme hooks from here, never reach
 * into individual files:
 *   import { useTheme, spacing, radius } from '@/design';
 *
 * Skill rule `imports-design-system-folder`.
 */

export * from '@/design/tokens';
export * from '@/design/theme-resolve';
export * from '@/design/theme';
export * from '@/design/storage';