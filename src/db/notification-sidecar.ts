/**
 * Device-local renewal-reminder bookkeeping.
 *
 * Supabase is the source of truth for subscriptions; a scheduled
 * notification's id is only meaningful on the device that scheduled it, so it
 * lives in a small SQLite sidecar (`notification_map`, migration v5) keyed by
 * subscription id. Nothing here is synced.
 */

import { getDatabase } from '@/db/client';

/** All { subscriptionId → notificationId } pairs currently on this device. */
export async function getAllNotificationIds(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    subscription_id: string;
    notification_id: string;
  }>('SELECT subscription_id, notification_id FROM notification_map;');
  return Object.fromEntries(
    rows.map((r) => [r.subscription_id, r.notification_id]),
  );
}

/** Upsert the scheduled-notification id for a subscription. */
export async function setNotificationId(
  subscriptionId: string,
  notificationId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO notification_map (subscription_id, notification_id) VALUES (?, ?);',
    [subscriptionId, notificationId],
  );
}

/** Drop the sidecar row (subscription deleted or reminder cancelled). */
export async function deleteNotificationId(
  subscriptionId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM notification_map WHERE subscription_id = ?;',
    subscriptionId,
  );
}

/** Wipe the sidecar (Danger Zone wipe). */
export async function clearAllNotificationIds(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notification_map;');
}
