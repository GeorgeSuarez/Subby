/**
 * CategoryPicker — field row that opens a bottom-sheet list of categories.
 *
 * Matches the DateInput pattern: a Pressable field shows the current choice
 * (icon + label), and tapping it opens the design-system `Sheet` with one row
 * per category. Tapping a row commits immediately and closes the sheet.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable only, never Touchable*.
 *  - `ui-native-modals`: iOS uses the design-system `Sheet` (native Modal).
 *  - `ui-styling`: tokens only; selected rows use the accent color.
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Text } from '@/design/components';
import { iconName } from '@/design/icons';
import { Sheet } from '@/design/components/Sheet';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { CATEGORIES, categoryMeta } from '@/utils/constants';
import type { CategorySlug } from '@/types/subscription';

export interface CategoryPickerProps {
  value: CategorySlug;
  onSelect: (slug: CategorySlug) => void;
}

export function CategoryPicker({ value, onSelect }: CategoryPickerProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const current = categoryMeta(value);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const choose = useCallback(
    (slug: CategorySlug) => {
      onSelect(slug);
      setVisible(false);
    },
    [onSelect],
  );

  return (
    <View>
      <Pressable
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Pick a category"
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceHigher,
            borderColor: colors.border,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Ionicons
          name={iconName(current.icon)}
          size={20}
          color={colors.accent}
        />
        <Text
          variant="body"
          color="textPrimary"
          numberOfLines={1}
          style={styles.value}
        >
          {current.label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={visible} onDismiss={close}>
        <View style={styles.sheetHeader}>
          <Text variant="headline" weight="600">
            Category
          </Text>
          <Button variant="ghost" size="sm" onPress={close}>
            Cancel
          </Button>
        </View>
        <View style={styles.list}>
          {CATEGORIES.map((c) => {
            const selected = c.slug === value;
            return (
              <Pressable
                key={c.slug}
                onPress={() => choose(c.slug)}
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
                <Ionicons
                  name={iconName(c.icon)}
                  size={22}
                  color={selected ? colors.accent : colors.textSecondary}
                />
                <Text
                  variant="body"
                  weight={selected ? '600' : '400'}
                  color={selected ? 'accent' : 'textPrimary'}
                  style={styles.label}
                >
                  {c.label}
                </Text>
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
    height: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    gap: spacing.md,
  },
  label: {
    flex: 1,
  },
});
