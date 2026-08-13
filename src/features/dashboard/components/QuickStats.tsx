/**
 * QuickStats — 2×2 "card-in-card" stat grid (monthly / yearly / active /
 * biggest). Each tile is its own elevated cell.
 *
 * Skill rule `react-state-minimize`: every value is derived during render
 * from the active-subscriptions selector.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { AnimatedNumber } from '@/features/dashboard/components/AnimatedNumber';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useCurrency } from '@/store/useUIStore';
import {
  activeCount,
  largestMonthly,
  monthlyEquivalent,
  totalMonthlySpend,
  totalYearlySpend,
} from '@/utils/billing';
import { formatCurrency } from '@/utils/format';

export function QuickStats() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();

  const monthly = totalMonthlySpend(subs);
  const year = totalYearlySpend(subs);
  const count = activeCount(subs);
  const biggest = largestMonthly(subs);
  const biggestMonthly = biggest ? monthlyEquivalent(biggest) : 0;

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        Quick stats
      </Text>
      <View style={styles.grid}>
        <Tile
          icon="calendar-number-outline"
          label="Monthly"
          value={
            <AnimatedNumber
              value={monthly}
              format={(n) => formatCurrency(n, currency)}
              delayMs={240}
              duration={600}
            />
          }
        />
        <Tile
          icon="trending-up-outline"
          label="Yearly"
          value={
            <AnimatedNumber
              value={year}
              format={(n) => formatCurrency(n, currency)}
              delayMs={320}
              duration={600}
            />
          }
        />
        <Tile icon="apps-outline" label="Active" value={String(count)} />
        <Tile
          icon="arrow-up-circle-outline"
          label="Biggest"
          value={
            biggest ? (
              <AnimatedNumber
                value={biggestMonthly}
                format={(n) => formatCurrency(n, currency)}
                delayMs={400}
                duration={600}
              />
            ) : (
              '—'
            )
          }
          sublabel={biggest?.name}
        />
      </View>
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: React.ReactNode;
  sublabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.surfaceHigher,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.tileHeader}>
        <Ionicons name={icon} size={16} color={colors.textTertiary} />
        <Text variant="caption" color="textTertiary">
          {label}
        </Text>
      </View>
      <Text
        variant="headline"
        weight="700"
        color="textPrimary"
        numberOfLines={1}
      >
        {value}
      </Text>
      {sublabel ? (
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
