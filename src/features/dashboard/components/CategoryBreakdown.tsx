/**
 * CategoryBreakdown — monthly spend per category as horizontal bars.
 *
 * Bars are plain Views sized by each category's share of the monthly total —
 * no chart library. Rows are memo-friendly: every value is derived during
 * render from the active-subscriptions selector via `categoryBreakdown`.
 *
 * Skill rules:
 *  - `ui-styling`: tokens only; bar track/fill use palette colors + radius.
 *  - `react-state-minimize`: derived in render, never stored.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useCurrency } from '@/store/useUIStore';
import { categoryBreakdown } from '@/utils/billing';
import { formatCurrency } from '@/utils/format';

export function CategoryBreakdown() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const { colors } = useTheme();

  const items = categoryBreakdown(subs);

  if (items.length === 0) return null;

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">By category</Text>
      <View style={styles.stack}>
        {items.map((item) => (
          <View key={item.category} style={styles.item}>
            <View style={styles.itemHeader}>
              <Text variant="body" weight="600" color="textPrimary" numberOfLines={1} style={styles.label}>
                {item.label}
                <Text variant="caption" color="textTertiary"> · {item.count}</Text>
              </Text>
              <Text variant="body" color="textSecondary">
                {formatCurrency(item.monthlyTotal, currency)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(2, item.share * 100)}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  item: {
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
