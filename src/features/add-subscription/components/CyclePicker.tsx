/**
 * CyclePicker — field row that opens a bottom-sheet list of billing cycles.
 *
 * Matches the CategoryPicker pattern: a Pressable field shows the current
 * choice (label + cadence), and tapping it opens the design-system `Sheet`
 * with one row per cycle. Tapping a row commits immediately and closes the
 * sheet.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable only, never Touchable*.
 *  - `ui-native-modals`: uses the design-system `Sheet` (native Modal).
 *  - `ui-styling`: tokens only; selected rows use the accent color.
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Text } from '@/design/components';
import { Sheet } from '@/design/components/Sheet';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { CYCLES, cycleMeta } from '@/utils/constants';
import { cycleCadence } from '@/utils/format';
import type { Cycle } from '@/types/subscription';

export interface CyclePickerProps {
  value: Cycle;
  onSelect: (cycle: Cycle) => void;
}

export function CyclePicker({ value, onSelect }: CyclePickerProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const current = cycleMeta(value);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const choose = useCallback(
    (cycle: Cycle) => {
      onSelect(cycle);
      setVisible(false);
    },
    [onSelect],
  );

  return (
    <View>
      <Pressable
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Pick a billing cycle"
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceHigher,
            borderColor: colors.border,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text
          variant="body"
          color="textPrimary"
          numberOfLines={1}
          style={styles.value}
        >
          {current.label}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {cycleCadence(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={visible} onDismiss={close}>
        <View style={styles.sheetHeader}>
          <Text variant="headline" weight="600">
            Billing cycle
          </Text>
          <Button variant="ghost" size="sm" onPress={close}>
            Cancel
          </Button>
        </View>
        <View style={styles.list}>
          {CYCLES.map((c) => {
            const selected = c.cycle === value;
            return (
              <Pressable
                key={c.cycle}
                onPress={() => choose(c.cycle)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: colors.hairline },
                  selected ? { backgroundColor: colors.accentSoft } : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={styles.labelColumn}>
                  <Text
                    variant="body"
                    weight={selected ? '600' : '400'}
                    color={selected ? 'accent' : 'textPrimary'}
                  >
                    {c.label}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {cycleCadence(c.cycle)}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    gap: spacing.md,
  },
  labelColumn: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
