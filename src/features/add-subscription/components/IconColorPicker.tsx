/**
 * IconColorPicker — pick a brand glyph + tint color.
 *
 * Skill rule `ui-pressable`: Pressable chips for icons and color swatches.
 * Skill rule `list-performance-callbacks`: single onSelectIcon / onSelectColor
 * handlers owned by the parent (stable across re-renders).
 * Skill rule `ui-styling`: tiles use borderCurve 'continuous', gap.
 *
 * The icon palette mirrors the default icons surfaced per category, plus a
 * few " branding" extras; colors are a curated brand palette.
 */

import { StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/components';
import { iconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

/** Sidebar of common subscription glyphs (Ionicons names). */
export const ICON_PALETTE: readonly string[] = [
  'film-outline',
  'musical-notes-outline',
  'cloud-outline',
  'briefcase-outline',
  'code-slash-outline',
  'game-controller-outline',
  'newspaper-outline',
  'fitness-outline',
  'school-outline',
  'construct-outline',
  'cube-outline',
  'sparkles-outline',
  'globe-outline',
  'wifi-outline',
  'logo-github',
  'cart-outline',
  'pricetag-outline',
  'people-outline',
];

/** Curated brand palette for the tint swatches. */
export const COLOR_PALETTE: readonly string[] = [
  '#22D3EE', // cyan (default)
  '#F87171', // red
  '#FBBF24', // amber
  '#34D399', // green
  '#1DB954', // spotify
  '#E50914', // netflix
  '#1FA1FF', // icloud
  '#A259FF', // figma
  '#000000', // nyt
  '#8B949E', // github
];

export interface IconColorPickerProps {
  icon: string;
  color?: string;
  onSelectIcon: (name: string) => void;
  onSelectColor: (hex: string) => void;
}

export function IconColorPicker({
  icon,
  color,
  onSelectIcon,
  onSelectColor,
}: IconColorPickerProps) {
  const { colors } = useTheme();
  const swatchSize = 32;

  return (
    <View style={styles.container}>
      <Text variant="caption" color="textSecondary" weight="600">
        Icon
      </Text>
      <View style={styles.iconGrid}>
        {ICON_PALETTE.map((name) => {
          const selected = name === icon;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectIcon(name)}
              style={({ pressed }) => [
                styles.iconTile,
                {
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.surfaceHigher,
                  borderColor: selected ? colors.accent : colors.border,
                },
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <Ionicons
                name={iconName(name)}
                size={22}
                color={selected ? colors.accent : colors.textSecondary}
              />
            </Pressable>
          );
        })}
      </View>

      <Text
        variant="caption"
        color="textSecondary"
        weight="600"
        style={styles.colorLabel}
      >
        Color
      </Text>
      <View style={styles.colorRow}>
        {COLOR_PALETTE.map((hex) => {
          const selected = hex === color;
          return (
            <Pressable
              key={hex}
              accessibilityRole="button"
              accessibilityLabel={`Color ${hex}`}
              accessibilityState={{ selected }}
              onPress={() => onSelectColor(hex)}
              style={({ pressed }) => [
                {
                  width: swatchSize,
                  height: swatchSize,
                  borderRadius: swatchSize / 2,
                  backgroundColor: hex,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.accent : colors.border,
                },
                pressed ? { opacity: 0.6 } : null,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorLabel: {
    marginTop: spacing.xs,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
