/**
 * CategorySectionHeader — sticky, collapsible section header for the
 * subscriptions list.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable only, with `pressed` opacity feedback.
 *  - `list-performance-item-memo`: receives only primitives + one stable
 *    `onToggle` instance from the list root.
 *  - `rendering-no-falsy-and`: ternaries everywhere.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { iconName } from '@/design/icons';
import { spacing } from '@/design/tokens';
import type { CategorySlug } from '@/types/subscription';

export interface CategorySectionHeaderProps {
  category: CategorySlug;
  label: string;
  icon: string;
  count: number;
  collapsed: boolean;
  onToggle: (category: CategorySlug) => void;
}

export function CategorySectionHeader({
  category,
  label,
  icon,
  count,
  collapsed,
  onToggle,
}: CategorySectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={`${label}, ${count} subscription${count === 1 ? '' : 's'}, ${collapsed ? 'collapsed' : 'expanded'}`}
      accessibilityHint={collapsed ? 'Expand category' : 'Collapse category'}
      onPress={() => onToggle(category)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface },
        pressed ? { opacity: 0.6 } : null,
      ]}
    >
      <Avatar icon={icon} size="sm" />
      <View style={styles.body}>
        <Text variant="body" weight="600" color="textPrimary" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {`${count} subscription${count === 1 ? '' : 's'}`}
        </Text>
      </View>
      <Ionicons
        name={iconName(collapsed ? 'chevron-forward' : 'chevron-down')}
        size={18}
        color={colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
