/**
 * DashboardHero — the dashboard's single adaptive hero (one container rule).
 *
 * Hero state comes from `pickHeroState` (grill Q6): a trial ending within 3
 * days names the trial, an over/projected-over budget names the overage,
 * otherwise the monthly-spend anchor. Tapping a trial hero opens that
 * subscription; tapping a budget hero opens the subscriptions list; the
 * default hero is not tappable.
 *
 * Skill rules:
 *  - `react-state-minimize`: every aggregate is derived during render.
 *  - `rendering-no-falsy-and`: ternaries throughout.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, Text } from '@/design/components';
import { spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
} from '@/store/useSubscriptionsStore';
import {
  renewalsThisMonth,
  totalMonthlySpend,
  totalYearlySpend,
} from '@/utils/billing';
import { formatCurrency, formatCurrencyCompact } from '@/utils/format';
import { useBudget, useCurrency } from '@/store/useUIStore';
import { pickHeroState } from '@/features/dashboard/heroState';

export function DashboardHero() {
  const router = useRouter();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const currency = useCurrency();
  const budget = useBudget();

  // Derived during render (skill `react-state-minimize`).
  const hero = pickHeroState(subs, budget);
  const monthly = totalMonthlySpend(subs);
  const yearly = totalYearlySpend(subs);
  const monthCharges = renewalsThisMonth(subs);

  // One discrimination on hero.kind (grill Q6/Q11): the headline, tap
  // target, and accessibility label travel together so states can't
  // drift apart across separate cascades.
  const meta: HeroMeta =
    hero.kind === 'trial'
      ? {
          headline: (
            <TrialHeadline
              name={hero.trial.name}
              label={hero.trial.label}
              priceAfter={hero.priceAfter}
              moreCount={hero.moreCount}
              currency={currency}
              isLoading={isLoading}
            />
          ),
          onPress: () => router.push(`/subscription/${hero.trial.id}`),
          accessibilityLabel: `Trial ending: ${hero.trial.name}`,
        }
      : hero.kind === 'budget'
        ? {
            headline: (
              <BudgetHeadline
                over={hero.over}
                overAmount={hero.overAmount}
                budget={hero.budget}
                projected={hero.projected}
                currency={currency}
                isLoading={isLoading}
              />
            ),
            onPress: () => router.push('/subscriptions'),
            accessibilityLabel: 'Over budget — view subscriptions',
          }
        : {
            headline: (
              <DefaultHeadline
                monthly={monthly}
                yearly={yearly}
                monthCharges={monthCharges.count}
                currency={currency}
                isLoading={isLoading}
              />
            ),
          };

  const content = <View style={styles.body}>{meta.headline}</View>;

  const card = (
    <Card padding={spacing.xl} elevation="low">
      {content}
    </Card>
  );

  // Tap targets per state (grill Q11); the default hero is not tappable.
  return meta.onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.accessibilityLabel}
      onPress={meta.onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      {card}
    </Pressable>
  ) : (
    card
  );
}

/** One hero state's headline and tap behaviour — built together. */
type HeroMeta = {
  headline: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

// --- Headlines --------------------------------------------------------------

function DefaultHeadline({
  monthly,
  yearly,
  monthCharges,
  currency,
  isLoading,
}: {
  monthly: number;
  yearly: number;
  monthCharges: number;
  currency: Parameters<typeof formatCurrency>[1];
  isLoading: boolean;
}) {
  return (
    <View style={styles.headline}>
      <View style={styles.labelRow}>
        <Text variant="caption" color="textSecondary">
          Monthly spend
        </Text>
      </View>
      {isLoading ? (
        <Text variant="stat" color="textTertiary">
          —
        </Text>
      ) : (
        <Text variant="stat" color="accent">
          {formatCurrency(monthly, currency)}
        </Text>
      )}
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {formatCurrencyCompact(yearly, currency)} per year · {monthCharges}{' '}
        renewal{monthCharges === 1 ? '' : 's'} charging this month
      </Text>
    </View>
  );
}

function TrialHeadline({
  name,
  label,
  priceAfter,
  moreCount,
  currency,
  isLoading,
}: {
  name: string;
  label: string;
  priceAfter: number;
  moreCount: number;
  currency: Parameters<typeof formatCurrency>[1];
  isLoading: boolean;
}) {
  return (
    <View style={styles.headline}>
      <View style={styles.labelRow}>
        <Text variant="caption" color="warning">
          Trial ending
        </Text>
      </View>
      {isLoading ? (
        <Text variant="stat" color="textTertiary">
          —
        </Text>
      ) : (
        <Text variant="stat" color="textPrimary" numberOfLines={1}>
          {name}
        </Text>
      )}
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {label} · then {formatCurrency(priceAfter, currency)}/mo
        {moreCount > 0 ? ` · +${moreCount} more` : ''}
      </Text>
    </View>
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
    <View style={styles.headline}>
      <View style={styles.labelRow}>
        <Text variant="caption" color="negative">
          {over ? 'Over budget' : 'Over pace'}
        </Text>
      </View>
      {isLoading ? (
        <Text variant="stat" color="textTertiary">
          —
        </Text>
      ) : (
        <Text variant="stat" color="negative">
          {formatCurrency(overAmount, currency)}
        </Text>
      )}
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {over
          ? `of ${formatCurrency(budget, currency)} budget`
          : `of ${formatCurrency(budget, currency)} budget · projected ${formatCurrency(projected, currency)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.sm,
  },
  headline: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
