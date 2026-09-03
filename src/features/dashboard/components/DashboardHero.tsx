/**
 * DashboardHero — the dashboard's single adaptive hero (one container rule).
 *
 * Hero state comes from `pickHeroState` (grill Q6): a trial ending within 3
 * days names the trial, an over/projected-over budget names the overage,
 * otherwise the monthly-spend anchor. The budget quiet line lives in the
 * hero's footer slot and hides whenever the budget hero is active (grill Q8)
 * so the two can never duplicate. Tapping a trial hero opens that
 * subscription; tapping a budget hero opens the subscriptions list; the
 * default hero is not tappable.
 *
 * Skill rules:
 *  - `react-state-minimize`: every aggregate is derived during render.
 *  - Animations are transform/opacity only (pop scale + cycle-dot pulse).
 *  - `rendering-no-falsy-and`: ternaries throughout.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
  interpolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
} from '@/store/useSubscriptionsStore';
import {
  billingCyclePosition,
  budgetProgress,
  projectedMonthEndSpend,
  renewalsThisMonth,
  totalMonthlySpend,
  totalYearlySpend,
} from '@/utils/billing';
import { formatCurrency, formatCurrencyCompact } from '@/utils/format';
import { useBudget, useCurrency } from '@/store/useUIStore';
import { AnimatedNumber } from '@/features/dashboard/components/AnimatedNumber';
import { pickHeroState } from '@/features/dashboard/heroState';

export function DashboardHero() {
  const router = useRouter();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const currency = useCurrency();
  const budget = useBudget();
  const { colors, shadow } = useTheme();

  // Derived during render (skill `react-state-minimize`).
  const hero = pickHeroState(subs, budget);
  const monthly = totalMonthlySpend(subs);
  const yearly = totalYearlySpend(subs);
  const monthCharges = renewalsThisMonth(subs);
  const cycle = billingCyclePosition();
  const progress = budgetProgress(monthly, budget);
  const projection = projectedMonthEndSpend(subs);

  // Headline "pop" — a quick settle whenever the headline value changes.
  const headlineKey =
    hero.kind === 'trial'
      ? `trial:${hero.trial.id}:${hero.trial.days}`
      : hero.kind === 'budget'
        ? `budget:${hero.overAmount.toFixed(2)}`
        : `default:${monthly.toFixed(2)}`;

  // Billing-cycle dot — a soft, perpetual pulse (opacity + scale only).
  const dotPulse = useSharedValue(0);
  useEffect(() => {
    dotPulse.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400 }),
          withTiming(0, { duration: 1400 }),
        ),
        -1,
        false,
      ),
    );
  }, [dotPulse]);

  const dotPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(dotPulse.get(), [0, 1], [1, 1.4]) }],
    opacity: interpolate(dotPulse.get(), [0, 1], [0.55, 1]),
  }));

  // Tap targets per state (grill Q11); the default hero is not tappable.
  const onPress =
    hero.kind === 'trial'
      ? () => router.push(`/subscription/${hero.trial.id}`)
      : hero.kind === 'budget'
        ? () => router.push('/subscriptions')
        : undefined;

  // Quiet budget line — only when a budget is set and the budget hero is
  // not active (grill Q8: the handoff, never both at once).
  const showBudgetLine = budget > 0 && hero.kind !== 'budget';

  const content = (
    <>
      <PopNumber popKey={headlineKey}>
        {hero.kind === 'trial' ? (
          <TrialHeadline
            name={hero.trial.name}
            label={hero.trial.label}
            priceAfter={hero.priceAfter}
            more={hero.more}
            currency={currency}
            isLoading={isLoading}
          />
        ) : hero.kind === 'budget' ? (
          <BudgetHeadline
            over={hero.over}
            overAmount={hero.overAmount}
            budget={hero.budget}
            projected={hero.projected}
            currency={currency}
            isLoading={isLoading}
          />
        ) : (
          <DefaultHeadline
            count={subs.length}
            monthly={monthly}
            yearly={yearly}
            monthCharges={monthCharges.count}
            currency={currency}
            isLoading={isLoading}
          />
        )}
      </PopNumber>

      {hero.kind === 'default' ? (
        <View style={styles.cycleRow}>
          <View
            style={[
              styles.cycleTrack,
              { backgroundColor: colors.surfaceHigher },
            ]}
          >
            <Animated.View
              style={[
                styles.cycleDot,
                {
                  backgroundColor: colors.accent,
                  boxShadow: shadow('glowAccent'),
                  left: `${Math.min(0.98, Math.max(0.02, cycle.fraction)) * 100}%`,
                },
                dotPulseStyle,
              ]}
            />
          </View>
          <Text variant="caption" color="textTertiary">
            {`Day ${cycle.day} / ${cycle.daysInMonth}`}
          </Text>
        </View>
      ) : null}

      {showBudgetLine ? (
        <Text variant="caption" color="textSecondary">
          {budgetLineCopy(progress.pct, budget, projection.projected, currency)}
        </Text>
      ) : null}
    </>
  );

  const card = (
    <Card padding={spacing.xl} elevation="high">
      {content}
    </Card>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hero.kind === 'trial'
          ? `Trial ending: ${hero.trial.name}`
          : 'Over budget — view subscriptions'
      }
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      {card}
    </Pressable>
  ) : (
    card
  );
}

// --- Headlines --------------------------------------------------------------

/** Scale-settle wrapper for the headline block (transform only). */
function PopNumber({
  popKey,
  children,
}: {
  popKey: string;
  children: React.ReactNode;
}) {
  const popScale = useSharedValue(1);
  useEffect(() => {
    popScale.set(
      withSequence(
        withTiming(1.035, { duration: 140 }),
        withSpring(1, { damping: 14, stiffness: 220 }),
      ),
    );
  }, [popKey, popScale]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: popScale.get() }],
  }));

  return <Animated.View style={popStyle}>{children}</Animated.View>;
}

function DefaultHeadline({
  count,
  monthly,
  yearly,
  monthCharges,
  currency,
  isLoading,
}: {
  count: number;
  monthly: number;
  yearly: number;
  monthCharges: number;
  currency: Parameters<typeof formatCurrency>[1];
  isLoading: boolean;
}) {
  return (
    <>
      <View style={styles.labelRow}>
        <Text variant="caption" color="textSecondary">
          Monthly spend
        </Text>
        <Text variant="caption" color="textTertiary" weight="500">
          / {count} active
        </Text>
      </View>
      <View style={styles.headlineRow}>
        <View>
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
      </View>
      <View style={styles.subRow}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {formatCurrencyCompact(yearly, currency)} per year · {monthCharges}{' '}
          renewal{monthCharges === 1 ? '' : 's'} charging this month
        </Text>
      </View>
    </>
  );
}

function TrialHeadline({
  name,
  label,
  priceAfter,
  more,
  currency,
  isLoading,
}: {
  name: string;
  label: string;
  priceAfter: number;
  more: number;
  currency: Parameters<typeof formatCurrency>[1];
  isLoading: boolean;
}) {
  return (
    <>
      <View style={styles.labelRow}>
        <Text variant="caption" color="warning">
          Trial ending
        </Text>
      </View>
      <View style={styles.headlineRow}>
        <View>
          {isLoading ? (
            <Text variant="stat" color="textTertiary">
              —
            </Text>
          ) : (
            <Text variant="stat" color="textPrimary" numberOfLines={1}>
              {name}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.subRow}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {label} · then {formatCurrency(priceAfter, currency)}/mo
          {more > 0 ? ` · +${more} more` : ''}
        </Text>
      </View>
    </>
  );
}

function BudgetHeadline({
  over,
  overAmount,
  budget,
  projected,
  currency,
  isLoading,
}: {
  over: boolean;
  overAmount: number;
  budget: number;
  projected: number;
  currency: Parameters<typeof formatCurrency>[1];
  isLoading: boolean;
}) {
  return (
    <>
      <View style={styles.labelRow}>
        <Text variant="caption" color="negative">
          {over ? 'Over budget' : 'Over pace'}
        </Text>
      </View>
      <View style={styles.headlineRow}>
        <View>
          {isLoading ? (
            <Text variant="stat" color="textTertiary">
              —
            </Text>
          ) : (
            <Text variant="stat" color="negative">
              <AnimatedNumber
                value={overAmount}
                format={(n) => formatCurrency(n, currency)}
                delayMs={140}
                duration={820}
              />
            </Text>
          )}
        </View>
      </View>
      <View style={styles.subRow}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {over
            ? `of ${formatCurrency(budget, currency)} budget`
            : `of ${formatCurrency(budget, currency)} budget · projected ${formatCurrency(projected, currency)}`}
        </Text>
      </View>
    </>
  );
}

// --- Helpers ----------------------------------------------------------------

function budgetLineCopy(
  pct: number,
  budget: number,
  projected: number,
  currency: Parameters<typeof formatCurrency>[1],
): string {
  const overBy = projected - budget;
  const pace =
    overBy > 0
      ? `projected ${formatCurrency(overBy, currency)} over`
      : overBy === 0
        ? 'projected to hit budget exactly'
        : `projected ${formatCurrency(-overBy, currency)} under`;
  return `${Math.round(pct * 100)}% of ${formatCurrency(budget, currency)} · ${pace}`;
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
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cycleTrack: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
  },
  cycleDot: {
    position: 'absolute',
    top: -2.5,
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
