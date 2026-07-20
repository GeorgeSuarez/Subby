/**
 * Add tab — transparent redirect that opens the `/subscription/add` modal.
 *
 * Pattern: every time this tab gains focus, push the modal. When the modal
 * is dismissed, this tab regains focus; we detect that via a `useRef` and
 * immediately switch the user back to the Dashboard tab so they never sit
 * on the empty "add" tab content.
 *
 * Skill rules:
 *  - `react-state-minimize`: no derived state — `justOpenedRef` is a mutable
 *    ref (a "have I just opened the modal" latch), not React state.
 *  - `react-state-dispatcher`: navigation actions are pure side effects of
 *    the focus event, not of React state.
 */

import { useRef, useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

export default function AddTabRedirect() {
  const router = useRouter();
  // Latch: true → we just opened the modal; next focus event should
  // bounce the user back to the dashboard instead of re-opening.
  const justOpenedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (justOpenedRef.current) {
        // Modal was opened previously and is now dismissed → return to dashboard.
        justOpenedRef.current = false;
        // Root route resolves to the (tabs)/index screen via the index redirect.
        // `replace` avoids leaving the Add tab in the back stack.
        router.replace('/');
        return;
      }
      justOpenedRef.current = true;
      router.push('/subscription/add');
    }, [router]),
  );

  // Render nothing — the modal covers the screen immediately on focus.
  return <View style={{ flex: 1, backgroundColor: 'transparent' }} />;
}