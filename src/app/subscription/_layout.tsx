/**
 * Modal route group for the subscription add/edit flow.
 *
 * Skill rule `ui-native-modals`: present these as native platform modals via
 * expo-router's `presentation: 'formSheet'` (iOS) / dialog (Android).
 */

import { Stack } from 'expo-router';

export default function SubscriptionModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'formSheet',
        headerShown: true,
      }}
    />
  );
}