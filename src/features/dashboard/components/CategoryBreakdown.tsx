/**
 * CategoryBreakdown — monthly spend per category as a pie chart.
 *
 * A donut chart (true SVG arc slices, distinct hues per category) with the
 * monthly total in the center; the top categories are drawn as slices and
 * everything beyond `MAX_SLICES` merges into an "Other" slice. Rows below
 * form the legend (tone dot + label + count + amount).
 *
 * Skill rules:
 *  - `ui-styling`: tokens + radius; hues stay in the semantic family.
 *  - `react-state-minimize`: derived in render, never stored.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useCurrency } from '@/store/useUIStore';
import { categoryBreakdown } from '@/utils/billing';
import { formatCurrency } from '@/utils/format';
import { PieChart } from '@/features/dashboard/components/PieChart';

/** Distinct categorical hues, cycled by category order. */
const CATEGORY_TONES = [
  '#22D3EE', // cyan
  '#A78BFA', // violet
  '#FBBF24', // amber
  '#34D399', // emerald
  '#FB7185', // rose
  '#60A5FA', // blue
  '#FB923C', // orange
  '#2DD4BF', // teal
  '#F472B6', // pink
  '#A3E635', // lime
  '#818CF8', // indigo
  '#F87171', // red
] as const;

/** Pie slices to draw before merging the rest into "Other". */
const MAX_SLICES = 6;

export function CategoryBreakdown() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const { colors } = useTheme();

  const items = categoryBreakdown(subs);

  if (items.length === 0) return null;

  const grand = items.reduce((sum, item) => sum + item.monthlyTotal, 0);
  const head = items.slice(0, MAX_SLICES);
  const tail = items.slice(MAX_SLICES);

  type LegendItem = {
    key: string;
    label: string;
    count: number;
    amount: number;
    color: string;
  };

  const legend: LegendItem[] = head.map((item, i) => ({
    key: item.category,
    label: item.label,
    count: item.count,
    amount: item.monthlyTotal,
    color: toneFor(i),
  }));
  if (tail.length > 0) {
    legend.push({
      // Prefix so the key can't collide with a real 'other' category.
      key: 'merged-other',
      label: 'Other',
      count: tail.reduce((sum, item) => sum + item.count, 0),
      amount: tail.reduce((sum, item) => sum + item.monthlyTotal, 0),
      color: colors.textTertiary,
    });
  }

  const slices = legend.map((item) => ({
    value: item.amount,
    color: item.color,
  }));

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        By category
      </Text>

      <View style={styles.chartWrap}>
        <PieChart
          slices={slices}
          holeColor={colors.surfaceElevated}
          center={
            <View style={styles.center}>
              <Text variant="caption" color="textTertiary">
                Monthly
              </Text>
              <Text
                variant="headline"
                weight="700"
                color="textPrimary"
                numberOfLines={1}
              >
                {formatCurrency(grand, currency)}
              </Text>
            </View>
          }
        />
      </View>

      <View style={styles.stack}>
        {legend.map((item) => (
          <View key={item.key} style={styles.item}>
            <View style={styles.itemHeader}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
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
                {formatCurrency(item.amount, currency)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Cycle-safe hue lookup (index access is typed as possibly-undefined). */
function toneFor(index: number): string {
  return CATEGORY_TONES[index % CATEGORY_TONES.length] ?? CATEGORY_TONES[0];
}

const styles = StyleSheet.create({
  chartWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  center: {
    alignItems: 'center',
    gap: 2,
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
