/**
 * Ionicons glyph-name coercion.
 *
 * The app stores icon names as plain strings (form palette, category
 * defaults, user data). `<Ionicons name={...}>` requires a known glyph key;
 * this is the single place the string is asserted into that key space.
 */

import type { Ionicons } from '@expo/vector-icons';

/** Coerce a stored icon string into an Ionicons glyph name. */
export function iconName(name: string): keyof typeof Ionicons.glyphMap {
  // SAFETY: names enter through curated sources (ICON_PALETTE, category
  // defaults, form input constrained to those) or existing user data from the
  // same sources; a name missing from the glyph map renders a blank box
  // instead of crashing, so the assertion cannot break the UI.
  return name as keyof typeof Ionicons.glyphMap;
}
