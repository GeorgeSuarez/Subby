/**
 * ThisMonthCard — "Charging this month" strip.
 *
 * Shows the total charges coming due from today through the end of the current
 * calendar month (real charge amounts, not monthly equivalents), with the
 * renewal count alongside.
 *
 * Skill rule `react-state-minimize`: the totals are derived during render from
 * the active-subscriptions selector via `renewalsThisMonth` — never stored.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useCurrency } from '@/store/useUIStore';
import { renewalsThisMonth } from '@/utils/billing';
import { formatCurrency } from '@/utils/format';
import { AnimatedNumber } from '@/features/dashboard/components/AnimatedNumber';

export function ThisMonthCard() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const { colors } = useTheme();

  const charges = renewalsThisMonth(subs);

  return (
    <Card padding={spacing.lg} elevation="low">
      <View style={[styles.row, { borderColor: colors.hairline }]}>
        <Text variant="caption" color="textSecondary" weight="600">Charging this month</Text>
        <Text variant="caption" color="textTertiary">
          {charges.count} renewal{charges.count === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={styles.amountRow}>
        <Text variant="display" color="textPrimary">
          <AnimatedNumber
            value={charges.total}
            format={(n) => formatCurrency(n, currency)}
            delayMs={200}
            duration={600}
          />
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountRow: {
    marginTop: spacing.xs,
  },
});
