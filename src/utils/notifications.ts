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
import * as Notifications from 'expo-notifications';

import { reminderDateFor } from '@/utils/billing';
import type { Subscription } from '@/types/subscription';

const CHANNEL_ID = 'renewals';

let channelReady = false;

/** Create the Android channel once. iOS needs no channel. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Renewal reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Are reminders enabled by the user AND permissions granted? */
export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Schedule the reminder for a subscription's next renewal. Returns the id. */
export async function scheduleRenewalReminder(
  sub: Subscription,
  remindersEnabled: boolean,
): Promise<string | null> {
  if (!remindersEnabled) return null;

  await ensureAndroidChannel();
  if (!(await ensurePermissions())) return null;

  const triggerDate = reminderDateFor(sub.nextRenewal);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${sub.name} renews tomorrow`,
      body: `${sub.name} charges ${sub.currency} ${sub.amount} tomorrow.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: CHANNEL_ID,
    },
  });
  return id;
}

/** Cancel a previously scheduled reminder (no-op when none was stored). */
export async function cancelRenewalReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
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
