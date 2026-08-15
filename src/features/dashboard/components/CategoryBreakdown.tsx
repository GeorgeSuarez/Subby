/**
 * CategoryBreakdown — monthly spend per category as one stacked bar.
 *
 * A single horizontal bar segmented by each category's share of the monthly
 * total (cyan-family tones), with the rows below acting as the legend. Reads
 * in one glance — no chart library, plain Views sized by flex share.
 *
 * Skill rules:
 *  - `ui-styling`: tokens + radius; segment tones stay in the accent family.
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

/** Cyan-family segment tones, cycled by category order. */
const SEGMENT_TONES = [
  '#22D3EE',
  '#67E8F9',
  '#0E7490',
  '#155E75',
  '#38BDF8',
] as const;

export function CategoryBreakdown() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const { colors } = useTheme();

  const items = categoryBreakdown(subs);

  if (items.length === 0) return null;

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        By category
      </Text>

      <View
        style={[styles.segmentBar, { backgroundColor: colors.surfaceHigher }]}
      >
        {items.map((item, i) => (
          <View
            key={item.category}
            style={[
              styles.segment,
              {
                flex: item.share,
                backgroundColor: SEGMENT_TONES[i % SEGMENT_TONES.length],
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.stack}>
        {items.map((item, i) => (
          <View key={item.category} style={styles.item}>
            <View style={styles.itemHeader}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: SEGMENT_TONES[i % SEGMENT_TONES.length] },
                ]}
              />
              <Text
                variant="body"
                weight="600"
                color="textPrimary"
                numberOfLines={1}
                style={styles.label}
              >
                {item.label}
                <Text variant="caption" color="textTertiary">
                  {' '}
                  · {item.count}
                </Text>
              </Text>
              <Text variant="body" color="textSecondary">
                {formatCurrency(item.monthlyTotal, currency)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  segmentBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    gap: 2,
    marginTop: spacing.md,
  },
  segment: {
    borderRadius: radius.pill,
  },
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
  },
});
