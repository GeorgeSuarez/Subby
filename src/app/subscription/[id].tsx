/**
 * Subscription detail modal route.
 *
 * Thin wrapper around the `subscription-detail` feature module. The route only
 * owns:
 *  - Reading the `id` param from the dynamic route.
 *  - Wiring the store to the screen via the `useSubscriptionById` selector.
 *  - Navigation handlers for the Edit (`/subscription/add?id=…`) and Close
 *    actions.
 *
 * All UI lives in the feature module so the route stays trivial and the screen
 * stays unit-testable without expo-router in the test bundle.
 */

import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { DetailScreen } from '@/features/subscription-detail';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';

export default function SubscriptionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // `useSubscriptionById` reads from the cache; previous Step 8 wiring refreshes
  // the cache via `useFocusEffect` in the parent list, so mutations land here
  // automatically when returning from Edit.
  const sub = useSubscriptionsStore((s) => s.subs.find((x) => x.id === id));

  const onEdit = useCallback(() => {
    router.push({ pathname: '/subscription/add', params: { id } });
  }, [router, id]);

  const onDismiss = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/subscriptions');
    }
  }, [router]);

  return <DetailScreen sub={sub ?? null} id={id ?? ''} onEdit={onEdit} onDismiss={onDismiss} />;
}