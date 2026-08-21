/**
 * Renewal reminder scheduling — thin wrapper around `expo-notifications`.
 *
 * A reminder fires the day before each renewal at 09:00 (the pure date math
 * lives in `billing.reminderDateFor`, which is Jest-testable). Android needs a
 * notification channel created once; permissions are requested lazily on the
 * first schedule. The scheduled notification's id is persisted in the local
 * sidecar (`db/notification-sidecar`) so edits/archives/deletes can cancel it.
 *
 * The module takes `remindersEnabled` as a parameter — it never reads stores —
 * so it stays importable without pulling the store graph in (no require
 * cycles) and its behaviour is explicit at the call site.
 *
 * NOTE: importing this module pulls in expo-notifications (native), so it must
 * not be imported from Jest-tested modules.
 */

import { Platform } from 'react-native';

import { reminderDateFor } from '@/utils/billing';
import type { Subscription } from '@/types/subscription';

const CHANNEL_ID = 'renewals';

let channelReady = false;

// Lazy loader for expo-notifications — static import crashes in Expo Go on
// Android (SDK 53+) because `expo-notifications` runs side-effect code that
// calls push-token APIs which throw in that environment (see
// DevicePushTokenAutoRegistration.fx). We defer the require until first use
// and guard against Expo Go.
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
let loadAttempted = false;

function getNotifications(): NotificationsModule | null {
  if (loadAttempted) return Notifications;
  loadAttempted = true;
  try {
    // Skip loading entirely in Expo Go on Android — even requiring the
    // module throws (push functionality removed in SDK 53).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isRunningInExpoGo } = require('expo');
    if (isRunningInExpoGo?.() && Platform.OS === 'android') return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    return Notifications;
  } catch {
    return null;
  }
}

/** Create the Android channel once. iOS needs no channel. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  const N = getNotifications();
  if (!N) return;
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Renewal reminders',
    importance: N.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Are reminders enabled by the user AND permissions granted? */
export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const N = getNotifications();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await N.requestPermissionsAsync();
  return req.granted;
}

/** Schedule the reminder for a subscription's next renewal. Returns the id. */
export async function scheduleRenewalReminder(
  sub: Subscription,
  remindersEnabled: boolean,
): Promise<string | null> {
  if (!remindersEnabled) return null;
  const N = getNotifications();
  if (!N) return null;

  try {
    await ensureAndroidChannel();
    if (!(await ensurePermissions())) return null;

    const triggerDate = reminderDateFor(sub.nextRenewal);
    const id = await N.scheduleNotificationAsync({
      content: {
        title: `${sub.name} renews tomorrow`,
        body: `${sub.name} charges ${sub.currency} ${sub.amount} tomorrow.`,
        sound: true,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: CHANNEL_ID,
      },
    });
    return id;
  } catch {
    // Notification support is limited in Expo Go and can fail independently
    // of the subscription mutation. A reminder is optional; never turn a
    // successful save into a reported subscription failure.
    return null;
  }
}

/** Cancel a previously scheduled reminder (no-op when none was stored). */
export async function cancelRenewalReminder(
  notificationId: string | null | undefined,
): Promise<void> {
  if (!notificationId) return;
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already cancelled / unknown id — ignore.
  }
}

/**
 * Re-schedule after an edit: cancel the old reminder (if any) and schedule a
 * new one for the updated renewal date. Returns the new notification id.
 */
export async function rescheduleRenewalReminder(
  sub: Subscription,
  previousNotificationId: string | null | undefined,
  remindersEnabled: boolean,
): Promise<string | null> {
  await cancelRenewalReminder(previousNotificationId);
  return scheduleRenewalReminder(sub, remindersEnabled);
}
