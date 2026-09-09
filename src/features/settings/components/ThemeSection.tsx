/**
 * ThemeSection — System / Light / Dark as individual rows.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: preference is read from the persisted theme store;
 *    no local state. Active scheme is derived for display only.
 *  - `react-state-dispatcher`: the setter comes straight from the store.
 *  - `ui-pressable`: Pressable rows, never Touchable*.
 *  - `ui-styling`: tokens only; selected rows use the accent color.
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/components';
import { useTheme, useThemeStore } from '@/design/theme';
import { type ThemePreference } from '@/design/theme-resolve';
import { radius, spacing } from '@/design/tokens';
import { selection } from '@/utils/haptics';

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function ThemeSection() {
  const { colors } = useTheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const resolved = preference ?? 'system';

  return (
    <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const selected = opt.value === resolved;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label} theme`}
              accessibilityState={{ selected }}
              onPress={() => {
                void selection();
                setPreference(opt.value);
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: selected ? colors.accent : colors.border,
                },
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <Text
                variant="body"
                weight={selected ? '600' : '400'}
                color={selected ? 'accent' : 'textPrimary'}
                style={styles.label}
              >
                {opt.label}
              </Text>
              {selected ? (
                <Ionicons name="checkmark" size={20} color={colors.accent} />
              ) : null}
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
});
