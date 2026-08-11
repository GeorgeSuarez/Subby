/**
 * HeroSpend — big headline monthly total with count-up animation.
 *
 * Sources data from the subscriptions store and derives the monthly total
 * in render (skill `react-state-minimize`). The number animates from 0 to the
 * target on first mount and re-animates only when the value changes by >= 1.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: monthly total is derived, never stored.
 *  - `state-ground-truth`: `subs` is the ground truth; `monthly` is a pure
 *    function of it.
 *  - `js-hoist-intl`: formatCurrency is cached per currency inside utils/format.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { useActiveSubscriptions, useIsLoadingSubscriptions } from '@/store/useSubscriptionsStore';
import { budgetProgress, totalMonthlySpend, totalYearlySpend } from '@/utils/billing';
import { formatCurrency, formatCurrencyCompact } from '@/utils/format';
import { useBudget, useCurrency } from '@/store/useUIStore';
import { AnimatedNumber } from '@/features/dashboard/components/AnimatedNumber';

export function HeroSpend() {
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const currency = useCurrency();
  const budget = useBudget();
  const { colors } = useTheme();

  // DURING render we derive the totals from the active subscriptions.
  // No state for monthly/yearly; skill `react-state-minimize`.
  const monthly = totalMonthlySpend(subs);
  const yearly = totalYearlySpend(subs);
  const progress = budgetProgress(monthly, budget);

  return (
    <Card padding={spacing.xl} elevation="high">
      <View style={styles.labelRow}>
        <Text variant="caption" color="textSecondary">Monthly spend</Text>
        <Text variant="caption" color="textTertiary" weight="500">/ {subs.length} active</Text>
      </View>

      {/* Stat variant gives the oversized runner-up look */}
      <View style={styles.headlineRow}>
        {isLoading ? (
          <Text variant="stat" color="textTertiary">—</Text>
        ) : (
          <Text variant="stat" color="textPrimary">
            <AnimatedNumber
              value={monthly}
              format={(n) => formatCurrency(n, currency)}
              delayMs={140}
              duration={820}
            />
          </Text>
        )}
      </View>

      {/* Sub row: yearly equivalent in caption, displayed compact. */}
      <View style={styles.subRow}>
        <Text variant="caption" color="textSecondary">
          {formatCurrencyCompact(yearly, currency)} per year
        </Text>
      </View>

      {/* Budget progress — only when a budget is set. */}
      {budget > 0 ? (
        <View style={styles.budget}>
          <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, progress.pct * 100)}%`,
                  backgroundColor: progress.over ? colors.negative : colors.accent,
                },
              ]}
            />
          </View>
          <Text variant="caption" color={progress.over ? 'negative' : 'textSecondary'}>
            {progress.over
              ? `Over budget by ${formatCurrency(progress.overAmount, currency)}`
              : `${Math.round(progress.pct * 100)}% of ${formatCurrency(budget, currency)} budget`}
          </Text>
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
    </Card>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headlineRow: {
    marginTop: spacing.xs,
  },
  subRow: {
    marginTop: spacing.xs,
  },
  budget: {
    marginTop: spacing.md,
    gap: spacing.xs,
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
  divider: {
    height: 1,
    marginTop: spacing.md,
  },
});