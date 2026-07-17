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
 */

import { useCallback, type ComponentProps } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import { useActiveSubscriptions, useIsLoadingSubscriptions } from '@/store/useSubscriptionsStore';
import { HeroSpend } from '@/features/dashboard/components/HeroSpend';
import { QuickStats } from '@/features/dashboard/components/QuickStats';
import { RenewalsList } from '@/features/dashboard/components/RenewalsList';
import { AddFab } from '@/features/dashboard/components/AddFab';

type ScrollViewProps = ComponentProps<typeof ScrollView>;

export function DashboardScreen() {
  const router = useRouter();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();

  // Stable FAB handler — `useCallback` so AddFab's memo + ListRow-style
  // depends-on-stable-props pattern holds (skill `list-performance-callbacks`).
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
        <AddFab onPress={onAdd} />
      </Surface>
    );
  }

  const scrollProps: ScrollViewProps = {
    contentInsetAdjustmentBehavior: 'automatic',
    contentContainerStyle: styles.content,
    showsVerticalScrollIndicator: false,
  };

  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView {...scrollProps}>
        <HeroSpend />
        <RenewalsList />
        <QuickStats />
      </ScrollView>
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
    // Provide breathing room above the FAB so the last card isn't covered.
    paddingBottom: spacing['3xl'],
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});