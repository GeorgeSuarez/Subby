/**
 * HeroSpend — big headline monthly total with count-up animation.
 *
 * The single money anchor of the dashboard: monthly spend, its yearly
 * equivalent, and how many renewals are charging this month. Sits on a subtle
 * accent wash so it reads as the hero; the budget progress line appears when
 * a budget is set.
 *
 * Skill rules:
 *  - `react-state-minimize`: monthly total is derived, never stored.
 *  - `state-ground-truth`: `subs` is the ground truth; `monthly` is a pure
 *    function of it.
 *  - `js-hoist-intl`: formatCurrency is cached per currency inside utils/format.
 */

import { StyleSheet, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { Card, Text } from '@/design/components';
import { useColorMode, useTheme } from '@/design/theme';
import { layout, radius, spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
} from '@/store/useSubscriptionsStore';
import {
  budgetProgress,
  projectedMonthEndSpend,
  renewalsThisMonth,
  totalMonthlySpend,
  totalYearlySpend,
} from '@/utils/billing';
import { formatCurrency, formatCurrencyCompact } from '@/utils/format';
import { useBudget, useCurrency } from '@/store/useUIStore';
import { AnimatedNumber } from '@/features/dashboard/components/AnimatedNumber';

export function HeroSpend() {
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const currency = useCurrency();
  const budget = useBudget();
  const scheme = useColorMode();
  const { colors, shadow } = useTheme();

  // DURING render we derive the totals from the active subscriptions.
  // No state for monthly/yearly; skill `react-state-minimize`.
  const monthly = totalMonthlySpend(subs);
  const yearly = totalYearlySpend(subs);
  const monthCharges = renewalsThisMonth(subs);
  const progress = budgetProgress(monthly, budget);
  const projection = projectedMonthEndSpend(subs);

  const content = (
    <>
      <View style={styles.labelRow}>
        <Text variant="caption" color="textSecondary">
          Monthly spend
        </Text>
        <Text variant="caption" color="textTertiary" weight="500">
          / {subs.length} active
        </Text>
      </View>

      {/* Stat variant gives the oversized runner-up look */}
      <View style={styles.headlineRow}>
        {isLoading ? (
          <Text variant="stat" color="textTertiary">
            —
          </Text>
        ) : (
          <Text variant="stat" color="accent">
            <AnimatedNumber
              value={monthly}
              format={(n) => formatCurrency(n, currency)}
              delayMs={140}
              duration={820}
            />
          </Text>
        )}
      </View>

      {/* Sub row: yearly equivalent + renewals charging this month. */}
      <View style={styles.subRow}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {formatCurrencyCompact(yearly, currency)} per year ·{' '}
          {monthCharges.count} renewal{monthCharges.count === 1 ? '' : 's'}{' '}
          charging this month
        </Text>
      </View>

      {/* Budget progress — only when a budget is set. */}
      {budget > 0 ? (
        <View style={styles.budget}>
          <View
            style={[styles.track, { backgroundColor: colors.surfaceHigher }]}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, progress.pct * 100)}%`,
                  backgroundColor: progress.over
                    ? colors.negative
                    : colors.accent,
                },
              ]}
            />
          </View>
          <Text
            variant="caption"
            color={progress.over ? 'negative' : 'textSecondary'}
          >
            {progress.over
              ? `Over budget by ${formatCurrency(progress.overAmount, currency)}`
              : `${Math.round(progress.pct * 100)}% of ${formatCurrency(budget, currency)} budget`}
          </Text>
          {projection.remaining > 0 ? (
            <Text
              variant="caption"
              color={projection.projected > budget ? 'negative' : 'accent'}
            >
              {projectionCopy(projection.projected, budget, currency)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  );

  // iOS 26 Liquid Glass hero with a quiet accent-wash card as the fallback.
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={scheme}
        style={[
          styles.glass,
          {
            borderColor: colors.hairline,
            boxShadow: shadow('lg'),
          },
        ]}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <Card
      padding={spacing.xl}
      elevation="high"
      style={[styles.hero, { backgroundColor: colors.accentSoft }]}
    >
      {content}
    </Card>
  );
}

// --- Helpers ----------------------------------------------------------------

function projectionCopy(
  projected: number,
  budget: number,
  currency: ReturnType<typeof useCurrency>,
): string {
  const overBy = projected - budget;
  if (overBy > 0) {
    return `On track to end the month ${formatCurrency(overBy, currency)} over budget`;
  }
  if (overBy === 0) {
    return 'On track to hit your budget exactly';
  }
  return `On track to end the month ${formatCurrency(-overBy, currency)} under budget`;
}

const styles = StyleSheet.create({
  hero: {
    borderColor: 'transparent',
  },
  glass: {
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: layout.cardRadius,
    padding: spacing.xl,
  },
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
});
