/**
 * Auth route group — native stack for the sign-in / sign-up screens.
 *
 * Skill rule `navigation-native-navigators`: native Stack via expo-router, no
 * JS-based navigators. Headers are hidden because each screen carries its own
 * brand lockup and headline.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
