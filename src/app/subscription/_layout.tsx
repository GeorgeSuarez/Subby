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
        // No "Add" title — the form carries its own header content.
        title: '',
      }}
    >
      <Stack.Screen name="add" />
      {/* Edit must NOT be a sheet: it's pushed on top of the [id] formSheet,
          and sheet-over-sheet in one stack renders a blank black screen. */}
      <Stack.Screen name="edit" options={{ presentation: 'card' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
