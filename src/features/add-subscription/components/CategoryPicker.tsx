/**
 * CategoryPicker — horizontal wrapping row of category chips.
 *
 * Skill rule `ui-pressable`: Chip is Pressable-based. Single onSelect
 * callback, stable across re-renders.
 */

import { StyleSheet, View, ScrollView } from 'react-native';

import { Chip, Text } from '@/design/components';
import { spacing } from '@/design/tokens';
import { CATEGORIES } from '@/utils/constants';
import type { CategorySlug } from '@/types/subscription';

export interface CategoryPickerProps {
  value: CategorySlug;
  onSelect: (slug: CategorySlug) => void;
}

export function CategoryPicker({ value, onSelect }: CategoryPickerProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroller}
      >
        {CATEGORIES.map((c) => {
          const selected = c.slug === value;
          return (
            <Chip
              key={c.slug}
              selected={selected}
              onPress={() => onSelect(c.slug)}
              style={styles.chip}
            >
              {c.label}
            </Chip>
          );
        })}
      </ScrollView>
      <Text variant="caption" color="textTertiary" style={styles.current}>
        Selected: {CATEGORIES.find((c) => c.slug === value)?.label ?? 'Unknown'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  scroller: {
    gap: spacing.xs,
    paddingVertical: spacing.xs / 2,
    paddingRight: spacing.lg,
  },
  chip: {
    marginBottom: 0,
  },
  current: {
    marginTop: spacing.xs / 2,
  },
});