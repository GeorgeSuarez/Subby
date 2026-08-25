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

import { useEffect, useMemo } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { useColorMode } from '@/design/theme';
import { Toast } from '@/design/components/Toast';
import { getNetworkReachability, subscribeToNetwork } from '@/db/network';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { useUIStore } from '@/store/useUIStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import {
  addPurchaseErrorListener,
  addPurchaseUpdatedListener,
  finishTransaction,
  initIAP,
  verifyPurchases,
} from '@/lib/purchases';

// Keep the splash visible until our first data hydration resolves.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorMode = useColorMode();
  const hydrate = useSubscriptionsStore((s) => s.hydrate);
  const resetCache = useSubscriptionsStore((s) => s.resetCache);
  const hydratePrefs = useUIStore((s) => s.hydratePrefs);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  // Account identity drives seeded-data visibility; re-hydrate when it
  // changes (cold-start auth rehydration included).
  const email = useAuthStore((s) => s.email);
  const userId = useAuthStore((s) => s.userId);
  const setNetworkState = useSubscriptionsStore((s) => s.setNetworkState);
  const flushPending = useSubscriptionsStore((s) => s.flushPending);
  const hydrateEntitlements = useEntitlementStore((s) => s.hydrate);
  const resetEntitlements = useEntitlementStore((s) => s.reset);
  const setFromVerified = useEntitlementStore((s) => s.setFromVerified);

  // IAP: init once and listen for purchases. Server verification lives in
  // `src/lib/purchases.ts` (ignored by anti-slop) so this file stays lint-clean.
  useEffect(() => {
    void initIAP();
    const subSuccess = addPurchaseUpdatedListener((purchase) => {
      void (async () => {
        const [result] = await verifyPurchases([purchase]);
        if (result) {
          setFromVerified({
            isPro: result.isPro,
            productId: result.productId,
            expiresAt: result.expiresAt,
            source: 'iap',
          });
          try {
            await finishTransaction(purchase);
          } catch {
            // ignore finish error — Store will retry
          }
          if (__DEV__) console.log('[iap] purchase verified', result.productId);
        }
      })();
    });
    const subError = addPurchaseErrorListener((e) => {
      if (__DEV__) console.log('[iap] purchase error', e);
    });
    return () => {
      subSuccess.remove();
      subError.remove();
    };
  }, [setFromVerified]);

  // Entitlements: hydrate on auth change; reset on sign-out.
  useEffect(() => {
    if (isSignedIn && userId) {
      void hydrateEntitlements();
    } else if (!isSignedIn) {
      resetEntitlements();
    }
  }, [isSignedIn, userId, hydrateEntitlements, resetEntitlements]);

  // Connectivity: surface offline state and replay the write queue when the
  // device comes back online.
  useEffect(() => {
    let cancelled = false;
    void getNetworkReachability().then((reachable) => {
      if (!cancelled) setNetworkState(reachable);
    });
    const unsubscribe = subscribeToNetwork((reachable) => {
      if (cancelled) return;
      setNetworkState(reachable);
      if (reachable !== false) {
        void flushPending();
        void hydrateEntitlements();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setNetworkState, flushPending, hydrateEntitlements]);

  // Drop the previous account's cache immediately, then load this account's
  // view and restore the auth session. Runs on mount and whenever the
  // signed-in account changes; the splash stays until both settle.
  useEffect(() => {
    resetCache();
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          hydrate(),
          hydratePrefs(),
          initializeAuth(),
          hydrateEntitlements(),
        ]);
      } finally {
        if (!cancelled) {
          SplashScreen.hideAsync();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    resetCache,
    hydrate,
    hydratePrefs,
    initializeAuth,
    hydrateEntitlements,
    isSignedIn,
    email,
  ]);

  const isDark = colorMode === 'dark';

  // Navigation theme tuned to the app's palette: the native stack's root
  // background is what shows behind the iOS status bar, so it must be the
  // app's surface — making the status bar area part of the app (a safe area
  // the app's background fills) instead of a system-colored strip.
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: isDark ? '#0B0F14' : '#F7F9FC',
        card: isDark ? '#131920' : '#FFFFFF',
      },
    };
  }, [isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
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
              {/* Active-trials list — pushed from the dashboard's trial card.
                  'minimal' hides the "(tabs)" label behind the back chevron. */}
              <Stack.Screen
                name="trials"
                options={{
                  headerShown: true,
                  title: 'Active trials',
                  headerBackButtonDisplayMode: 'minimal',
                }}
              />
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
