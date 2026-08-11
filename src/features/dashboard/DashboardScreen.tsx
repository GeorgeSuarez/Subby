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
import { spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
  useSubscriptionsStore,
} from '@/store/useSubscriptionsStore';
import { HeroSpend } from '@/features/dashboard/components/HeroSpend';
import { QuickStats } from '@/features/dashboard/components/QuickStats';
import { CategoryBreakdown } from '@/features/dashboard/components/CategoryBreakdown';
import { RenewalsList } from '@/features/dashboard/components/RenewalsList';

type ScrollViewProps = ComponentProps<typeof ScrollView>;

export function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const hydrate = useSubscriptionsStore((s) => s.hydrate);

  // Empty-state CTA — single stable callback (skill `list-performance-callbacks`).
  const onAdd = useCallback(() => {
    router.push('/subscription/add');
  }, [router]);

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
        onRefresh={() => void hydrate()}
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
        <CategoryBreakdown />
        <QuickStats />
      </ScrollView>
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
    paddingBottom: spacing['2xl'],
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});