/**
 * Brand colors — per-subscription tile colors.
 *
 * Each known service gets its real brand hex so the list pops instantly.
 * Unknown names fall back to a category color, then to a neutral.
 */

import type { CategorySlug } from '@/types/subscription';

// Exact brand hexes for demo seeds + common services
const BRAND_BY_NAME = {
  netflix: '#E50914',
  spotify: '#1DB954',
  github: '#24292E',
  'icloud+': '#007AFF',
  icloud: '#007AFF',
  peacock: '#6933FF',
  figma: '#F24E1E',
  'new york times': '#F5F5F0',
  'nytimes': '#F5F5F0',
  'new york': '#F5F5F0',
  'disney+': '#113CCF',
  disney: '#113CCF',
  youtube: '#FF0000',
  hbo: '#7A00E6',
  max: '#7A00E6',
} satisfies Record<string, string>;

// Fallback per category when name is unknown
const CATEGORY_COLOR = {
  streaming: '#E50914',
  music: '#1DB954',
  cloud: '#007AFF',
  productivity: '#7C3AED',
  developer: '#24292E',
  gaming: '#FF4655',
  news: '#E5E5E5',
  fitness: '#F59E0B',
  lifestyle: '#EC4899',
  education: '#06B6D4',
  utilities: '#6B7280',
  other: '#1B232E',
} satisfies Record<CategorySlug, string>;

/** Resolve a background hex for a subscription. */
export function brandBackground(name: string, category: CategorySlug): string {
  const key = name.trim().toLowerCase();
  // SAFETY: BRAND_BY_NAME is validated via satisfies Record<string,string>; string key may be missing → undefined fallback.
  // oxlint-disable-next-line anti-slop/no-known-value-widening -- arbitrary brand lookup, fallback to category
  const hit = (BRAND_BY_NAME as Record<string, string>)[key];
  if (hit) return hit;
  // try without + / spaces for fuzzy match
  const short = key.replace(/\+/g, '').trim();
  // SAFETY: same as above — brand map lookup by arbitrary string.
  // oxlint-disable-next-line anti-slop/no-known-value-widening -- arbitrary brand lookup, fallback to category
  const hitShort = (BRAND_BY_NAME as Record<string, string>)[short];
  if (hitShort) return hitShort;
  return CATEGORY_COLOR[category] ?? CATEGORY_COLOR.other;
}

/** White icon on dark bg, dark icon on light bg. */
export function brandIconColor(bg: string): string {
  // light backgrounds: NYT off-white, news fallback
  if (bg.toLowerCase() === '#f5f5f0' || bg.toLowerCase() === '#e5e5e5') return '#0B0F14';
  // simple luminance check for custom colors
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0B0F14' : '#FFFFFF';
}
