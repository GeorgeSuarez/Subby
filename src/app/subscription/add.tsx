/**
 * Add/Edit modal route.
 *
 * Reads an optional `id` query param: when present, switches into edit mode by
 * fetching the existing subscription via the store. Surface that record to the
 * screen so the rest of the UI lives in `@/features/add-subscription`.
 */

import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AddEditScreen } from '@/features/add-subscription';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';

export default function AddSubscriptionRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const existing = useSubscriptionsStore((s) =>
    typeof id === 'string' && id.length > 0
      ? (s.subs.find((x) => x.id === id) ?? null)
      : null,
  );

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

  return (
    <AddEditScreen
      existing={existing}
      onSaved={onSaved}
      onDismiss={onDismiss}
    />
  );
}
