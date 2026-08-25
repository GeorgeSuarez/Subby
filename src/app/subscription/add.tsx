/**
 * Add/Edit modal route.
 *
 * Reads an optional `id` query param: when present, switches into edit mode by
 * fetching the existing subscription via the store. Surface that record to the
 * screen so the rest of the UI lives in `@/features/add-subscription`.
 */

import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { AddEditScreen } from '@/features/add-subscription';
import { useIsPro, useIsProLoading } from '@/store/useEntitlementStore';
import {
  useActiveSubscriptions,
  useSubscriptionsStore,
} from '@/store/useSubscriptionsStore';
import { canAddSubscription, FREE_SUB_LIMIT_MESSAGE } from '@/utils/limits';

export default function AddSubscriptionRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  // expo-router can hand back string[] for repeated query params; take the
  // first occurrence or treat the route as "add mode".
  const idParam = Array.isArray(id) ? id[0] : id;
  const existing = useSubscriptionsStore((s) =>
    idParam ? (s.subs.find((x) => x.id === idParam) ?? null) : null,
  );
  const activeSubscriptions = useActiveSubscriptions();
  const isPro = useIsPro();
  const isProLoading = useIsProLoading();

  const onSaved = useCallback(
    (savedId: string) => {
      // Dismiss the modal and surface the detail screen.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/subscription/${savedId}`);
      }
    },
    [router],
  );

  const onDismiss = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/subscriptions');
    }
  }, [router]);

  const onUpgrade = useCallback(() => {
    router.replace('/subscription/paywall');
  }, [router]);

  if (
    !idParam &&
    !isProLoading &&
    !canAddSubscription(activeSubscriptions.length, isPro)
  ) {
    return (
      <Surface background="surface" style={styles.limit}>
        <EmptyState
          title="Free plan limit reached"
          body={FREE_SUB_LIMIT_MESSAGE}
          actionLabel="Unlock unlimited tracking"
          onAction={onUpgrade}
          decorationIcon="infinite-outline"
        />
      </Surface>
    );
  }

  return (
    <AddEditScreen
      existing={existing}
      onSaved={onSaved}
      onDismiss={onDismiss}
      onLimitReached={onUpgrade}
    />
  );
}

const styles = StyleSheet.create({
  limit: {
    flex: 1,
    justifyContent: 'center',
  },
});
