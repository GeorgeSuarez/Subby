/**
 * DashboardScreen — composes the DashboardHero, RenewalsList, and QuickStats cards.
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
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { EmptyState } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { useTheme } from '@/design/theme';
import { layout, spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useHasHydrated,
  useIsLoadingSubscriptions,
  useSubscriptionsStore,
} from '@/store/useSubscriptionsStore';
import { useCompletedOnboardingUserIds } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { notifyWarning } from '@/utils/haptics';
import { Text } from '@/design/components';
import { DashboardHero } from '@/features/dashboard/components/DashboardHero';
import { QuickStats } from '@/features/dashboard/components/QuickStats';
import { RenewalsList } from '@/features/dashboard/components/RenewalsList';
import { TrialsCard } from '@/features/dashboard/components/TrialsCard';
import { InsightStrip } from '@/features/dashboard/components/InsightStrip';
import { AddFab } from '@/features/dashboard/components/AddFab';
import { UnverifiedEmailBanner } from '@/features/dashboard/components/UnverifiedEmailBanner';
import { pickInsightExcept } from '@/features/dashboard/insights';
import { pickHeroState } from '@/features/dashboard/heroState';
import { shouldShowOnboarding } from '@/features/onboarding';
import { useCurrency, useBudget } from '@/store/useUIStore';

type ScrollViewProps = ComponentProps<typeof ScrollView>;

export function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const hasHydrated = useHasHydrated();
  const hydrate = useSubscriptionsStore((s) => s.hydrate);
  const currency = useCurrency();
  const budget = useBudget();

  // First-run gate — evaluated only after hydration settles so a cold start
  // never flashes an existing account into the wizard while rows are loading.
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const userId = useAuthStore((s) => s.userId);
  const completedUserIds = useCompletedOnboardingUserIds();
  if (
    hasHydrated &&
    shouldShowOnboarding({
      isSignedIn,
      userId,
      completedUserIds,
      subscriptionCount: subs.length,
    })
  ) {
    return <Redirect href="/onboarding" />;
  }

  // First-applicable dashboard insight — null hides the strip entirely.
  // The hero already names an urgent trial, so the strip skips that topic.
  const hero = pickHeroState(subs, budget);
  const insight = pickInsightExcept(
    subs,
    currency,
    hero.kind === 'trial' ? 'trial' : null,
  );

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
        <UnverifiedEmailBanner />
        <View style={styles.devBanner}>
          <Text variant="caption" weight="700" color="accent">
            DEV BUILD — data resets on reinstall
          </Text>
        </View>
        {insight ? <InsightStrip insight={insight} /> : null}
        <DashboardHero />
        <QuickStats />
        <RenewalsList />
        <TrialsCard />
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
    gap: spacing.md, // tighter for Quiet Ledger (+ hairline dividers between sections)
    // Extra bottom padding so the last card clears the floating Add FAB.
    paddingBottom: spacing['3xl'] + layout.fabSize,
  },
  devBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(14, 74, 92, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(14, 74, 92, 0.14)',
    alignSelf: 'center',
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});
