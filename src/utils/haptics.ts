/**
 * Haptics helper — thin wrapper around `expo-haptics` so calling code can
 * stay platform-agnostic. On platforms where haptics aren't supported (web,
 * or Android devices without a vibrator), calls no-op without throwing.
 *
 * Skill rule §3.3 (`animation-gesture-detector-press`): Reanimated worklets
 * that need to fire haptics use `runOnJS(impactLight)` from the UI thread.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Light impact — used for tap/select feedback. */
export function impactLight(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Soft impact — used for subtle chip / segmented selections. */
export function impactSoft(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

/** Rigid impact — used for snapping / pull-to-refresh style moments. */
export function impactRigid(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

/** Medium impact — used when surfacing a context menu / long-press. */
export function impactMedium(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Success chime — used after a successful save / mutation. */
export function notifySuccess(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning chime — used before a destructive confirm. */
export function notifyWarning(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error chime — used when a save fails. */
export function notifyError(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Selection tick — lightest possible acknowledgment of a selection change. */
export function selection(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return Haptics.selectionAsync();
}