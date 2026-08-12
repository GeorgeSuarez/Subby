/**
 * Root layout — providers, bootstrap, and the auth gate.
 *
 * Wraps every route with:
 *   - `GestureHandlerRootView` (required by react-native-gesture-handler)
 *   - `expo-router`'s `ThemeProvider` (native stack theming)
 *   - `expo-status-bar` styling
 *   - a one-shot `useEffect` that hydrates the subscriptions store and
 *     hides the splash screen once the database is ready.
 *   - an auth gate via `Stack.Protected`: signed-out users see only the
 *     `auth` group; signed-in users get the tabs plus the add/edit modal
 *     group (gating the modal too blocks signed-out deep links to it).
 *
 * Skill rules:
 *  - `navigation-native-navigators`: native stack/tabs via expo-router.
 *  - `react-state-minimize`: hydration is keyed on mount only; the store
 *    owns all subsequent state. The gate is derived from the auth store's
 *    `isSignedIn` — no local copies.
 *  - `animation-gpu-properties`: theme transitions use Reanimated `entering`
 *    FadeIn — opacity only, GPU-accelerated, no layout/paint per frame (§3.1).
 *  - `state-ground-truth`: the resolved color mode is the ground truth; the
 *    wrapper gets `key={colorMode}` so a scheme change triggers a remount of
 *    the surface, which Reanimated cross-fades.
 */

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { useColorMode } from '@/design/theme';
import { Toast } from '@/design/components/Toast';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';

// Keep the splash visible until our first data hydration resolves.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const colorMode = useColorMode();
  const hydrate = useSubscriptionsStore((s) => s.hydrate);
  const resetCache = useSubscriptionsStore((s) => s.resetCache);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  // Account identity drives seeded-data visibility; re-hydrate when it
  // changes (cold-start auth rehydration included).
  const email = useAuthStore((s) => s.email);

  // Drop the previous account's cache immediately, then load this account's
  // view and restore the auth session. Runs on mount and whenever the
  // signed-in account changes; the splash stays until both settle.
  useEffect(() => {
    resetCache();
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([hydrate(), initializeAuth()]);
      } finally {
        if (!cancelled) {
          SplashScreen.hideAsync();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resetCache, hydrate, initializeAuth, isSignedIn, email]);

  const isDark = colorMode === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {/* key change forces a remount when the resolved scheme flips;
            Reanimated's FadeIn entrance drives the cross-fade. */}
        <Animated.View
          key={colorMode}
          entering={FadeIn.duration(280)}
          style={{ flex: 1, backgroundColor: isDark ? '#0B0F14' : '#F7F9FC' }}
        >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={isSignedIn}>
              <Stack.Screen name="(tabs)" />
              {/* The add/edit modal group sits behind the same gate so a
                  signed-out user can't deep link into it. */}
              <Stack.Screen name="subscription" />
            </Stack.Protected>
            <Stack.Protected guard={!isSignedIn}>
              <Stack.Screen name="auth" />
            </Stack.Protected>
          </Stack>

          {/* Mounted above the navigator so toasts survive modal dismissal. */}
          <Toast />
        </Animated.View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}