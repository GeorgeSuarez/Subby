/**
 * QuickStats — three-column stat strip (yearly / count / biggest).
 *
 * Skill rule `react-state-minimize`: every value here is derived during
 * render from the active-subscriptions selector.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { AnimatedNumber } from '@/features/dashboard/components/AnimatedNumber';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useCurrency } from '@/store/useUIStore';
import { activeCount, largestMonthly, monthlyEquivalent, totalYearlySpend } from '@/utils/billing';
import { formatCurrency } from '@/utils/format';

export function QuickStats() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const { colors } = useTheme();

  const year = totalYearlySpend(subs);
  const count = activeCount(subs);
  const biggest = largestMonthly(subs);
  const biggestMonthly = biggest ? monthlyEquivalent(biggest) : 0;

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">Quick stats</Text>
      <View style={[styles.row, { borderColor: colors.hairline }]}>
        {/* Count-up is only applied to the currency-formatted numeric stats. */}
        <Stat
          label="Yearly"
          value={
            <AnimatedNumber
              value={year}
              format={(n) => formatCurrency(n, currency)}
              delayMs={260}
              duration={680}
            />
          }
        />
        <Divider />
        <Stat label="Active" value={String(count)} />
        <Divider />
        <Stat
          label="Biggest"
          value={
            biggest ? (
              <AnimatedNumber
                value={biggestMonthly}
                format={(n) => formatCurrency(n, currency)}
                delayMs={320}
                duration={680}
              />
            ) : '—'
          }
          sublabel={biggest?.name}
        />
      </View>
    </Card>
  );
}

function Stat({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" color="textTertiary">{label}</Text>
      <Text variant="headline" weight="700" color="textPrimary">{value}</Text>
      {sublabel ? (
        <Text variant="caption" color="textSecondary" numberOfLines={1}>{sublabel}</Text>
      ) : null}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    width: 1,
    marginVertical: spacing.xs,
  },
});