/**
 * Settings route group — one pushed screen per Settings section.
 *
 * The hub lives on the `(tabs)` settings tab; each row pushes its screen
 * here with a native header (mirrors the `trials` route precedent in the
 * root layout). Screens reuse the existing section components unchanged.
 */

import { Stack } from 'expo-router';

export default function SettingsGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="pro" options={{ title: 'Subby Pro' }} />
      <Stack.Screen name="theme" options={{ title: 'Theme' }} />
      <Stack.Screen name="currency" options={{ title: 'Currency' }} />
      <Stack.Screen name="budget" options={{ title: 'Budget' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="account" options={{ title: 'Account' }} />
      <Stack.Screen name="demo-data" options={{ title: 'Demo data' }} />
      <Stack.Screen name="danger-zone" options={{ title: 'Danger zone' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
