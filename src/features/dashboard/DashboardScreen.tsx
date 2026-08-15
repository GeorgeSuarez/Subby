/**
 * DashboardScreen — composes the HeroSpend, RenewalsList, and QuickStats cards.
 *
 * Skill rule `react-state-minimize`: every aggregate is derived during render
 * from the subscriptions store; this screen owns no subscription state.
 *
 * Skill rule `rendering-no-falsy-and`: ternaries throughout.
 *
 * Skill rule `ui-safe-area-scroll`: the dashboard is a flat ScrollView; on
 * iOS the native tab bar's automatic content inset handles the bottom inset
 * when disableAutomaticContentInsets isn't set. We set `contentInsetAdjustmentBehavior`
 * explicitly so behavior is identical on platforms that don't auto-apply it.
 *
 * Adding a new subscription is initiated via the center "Add" tab in the
 * native tab bar, not via a per-screen FAB. The empty-state CTA still routes
 * to the same modal.
 */

import { useCallback, type ComponentProps } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { useTheme } from '@/design/theme';
import { layout, spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
  useSubscriptionsStore,
} from '@/store/useSubscriptionsStore';
import { toast } from '@/store/useToastStore';
import { notifyWarning } from '@/utils/haptics';
import { HeroSpend } from '@/features/dashboard/components/HeroSpend';
import { QuickStats } from '@/features/dashboard/components/QuickStats';
import { CategoryBreakdown } from '@/features/dashboard/components/CategoryBreakdown';
import { RenewalsList } from '@/features/dashboard/components/RenewalsList';
import { TrialsCard } from '@/features/dashboard/components/TrialsCard';
import { ForecastCard } from '@/features/dashboard/components/ForecastCard';
import { InsightStrip } from '@/features/dashboard/components/InsightStrip';
import { AddFab } from '@/features/dashboard/components/AddFab';
import { pickInsight } from '@/features/dashboard/insights';
import { useCurrency } from '@/store/useUIStore';

type ScrollViewProps = ComponentProps<typeof ScrollView>;

export function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const hydrate = useSubscriptionsStore((s) => s.hydrate);
  const currency = useCurrency();

  // First-applicable dashboard insight — null hides the strip entirely.
  const insight = pickInsight(subs, currency);

  // Empty-state CTA — single stable callback (skill `list-performance-callbacks`).
  const onAdd = useCallback(() => {
    router.push('/subscription/add');
  }, [router]);

  const onRefresh = useCallback(() => {
    if (useSubscriptionsStore.getState().isOffline) {
      void notifyWarning();
      toast('No internet connection — showing saved data');
      return;
    }
    void hydrate();
  }, [hydrate]);

  // Skill `rendering-no-falsy-and`: ternary while loading, then conditional render.
  if (!isLoading && subs.length === 0) {
    return (
      <Surface background="surface" style={styles.empty}>
        <EmptyState
          title="No subscriptions yet"
          body="Add your first recurring expense to start tracking."
          actionLabel="Add subscription"
          onAction={onAdd}
        />
      </Surface>
    );
  }

  const scrollProps: ScrollViewProps = {
    contentInsetAdjustmentBehavior: 'automatic',
    contentContainerStyle: styles.content,
    showsVerticalScrollIndicator: false,
    refreshControl: (
      <RefreshControl
        refreshing={isLoading}
        onRefresh={onRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
      />
    ),
  };

  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView {...scrollProps}>
        <HeroSpend />
        <RenewalsList />
        <TrialsCard />
        <CategoryBreakdown />
        {insight ? <InsightStrip insight={insight} /> : null}
        <ForecastCard />
        <QuickStats />
      </ScrollView>
      {/* Primary add affordance — floats above the tab bar. The empty state
          has its own centered CTA, so the FAB only shows with content. */}
      <AddFab onPress={onAdd} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    // Extra bottom padding so the last card clears the floating Add FAB.
    paddingBottom: spacing['3xl'] + layout.fabSize,
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});
