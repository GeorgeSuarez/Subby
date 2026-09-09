/**
 * SettingsMenuRow — one drill-down row in the Settings hub.
 *
 * Shows a label, an optional one-line description, and a chevron.
 * Tapping pushes the dedicated screen for that section.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable only, with `pressed` opacity feedback.
 *  - `rendering-no-falsy-and`: ternaries only.
 *  - `ui-styling`: tokens only; `gap`, no margins.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';

export interface SettingsMenuRowProps {
  /** Row title (e.g. "Currency"). */
  label: string;
  /** One-line explanation shown under the label (e.g. "Default for all amounts"). */
  description?: string;
  /** Push the section screen. */
  onPress: () => void;
  /** Accessibility label override; defaults to the row label. */
  accessibilityLabel?: string;
  /** Render a hairline above the row (false for the first row in a group). */
  showDivider?: boolean;
}

export function SettingsMenuRow({
  label,
  description,
  onPress,
  accessibilityLabel,
  showDivider = true,
}: SettingsMenuRowProps) {
  const { colors } = useTheme();

  return (
    <View>
      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? { opacity: 0.6 } : null]}
      >
        <View style={styles.textWrap}>
          <Text
            variant="body"
            color="textPrimary"
            numberOfLines={1}
          >
            {label}
          </Text>
          {description ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
  },
  row: {
    flex: 1,
    minHeight: 88, // rows share the viewport; floor keeps two-line rows tappable
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
