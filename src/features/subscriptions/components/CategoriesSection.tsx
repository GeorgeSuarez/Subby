/**
 * CategoriesSection — collapsible category breakdown for the Subscriptions
 * tab, below the list header and above the rows (grill Q10).
 *
 * Expanded by default; the pie chart stays behind its existing ProGate.
 * Renders nothing when there are no categories to break down.
 *
 * Skill rules:
 *  - `react-state-minimize`: breakdown derived during render; only the
 *    collapsed flag is local UI state.
 *  - `rendering-no-falsy-and`: ternaries throughout.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { categoryBreakdown } from '@/utils/billing';
import { CategoryBreakdown } from '@/features/subscriptions/components/CategoryBreakdown';
import { ProGate } from '@/features/paywall/components/ProGate';

export function CategoriesSection() {
  const subs = useActiveSubscriptions();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);

  if (categoryBreakdown(subs).length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? 'Collapse categories' : 'Expand categories'
        }
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}
      >
        <View style={styles.header}>
          <Text variant="caption" color="textSecondary" weight="600">
            By category
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textTertiary}
          />
        </View>
      </Pressable>
      {expanded ? (
        <ProGate feature="pieChart">
          <CategoryBreakdown />
        </ProGate>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
