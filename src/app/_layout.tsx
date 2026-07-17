/**
 * Root layout — providers and bootstrap.
 *
 * Wraps every route with:
 *   - `GestureHandlerRootView` (required by react-native-gesture-handler)
 *   - `expo-router`'s `ThemeProvider` (native stack theming)
 *   - `expo-status-bar` styling
 *   - a one-shot `useEffect` that hydrates the subscriptions store and
 *     hides the splash screen once the database is ready.
 *
 * Skill rules:
 *  - `navigation-native-navigators`: native stack/tabs; we let expo-router
 *    handle this via the `(tabs)` route.
 *  - `react-state-minimize`: hydration is keyed on mount only; the store
 *    itself owns all subsequent state.
 */

import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { useColorMode } from '@/design/theme';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';

// Keep the splash visible until our first data hydration resolves.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const colorMode = useColorMode();
  const hydrate = useSubscriptionsStore((s) => s.hydrate);

  // Hydrate the subscriptions cache exactly once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hydrate();
      } finally {
        if (!cancelled) {
          SplashScreen.hideAsync();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const isDark = colorMode === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: isDark ? '#0B0F14' : '#F7F9FC' }}>
          <Slot />
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}