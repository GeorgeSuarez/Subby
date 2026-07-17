/**
 * first-run seed orchestrator.
 *
 * Called from the app's bootstrap flow only when the database has zero rows.
 * Idempotent: returns immediately if any rows exist.
 *
 * The pure draft list lives in `seed-data.ts` (no DB imports) so it is fully
 * testable in plain Node Jest.
 */

import { insertSubscription } from '@/db/queries';
import { getDatabase } from '@/db/client';
import { seedDrafts } from '@/db/seed-data';

/** Check if the table is empty (first launch). */
export async function shouldSeed(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM subscriptions;');
  return (row?.n ?? 0) === 0;
}

/** Insert the seed subscriptions if and only if the table is empty. */
export async function seedIfEmpty(): Promise<void> {
  if (!(await shouldSeed())) return;
  await seedNow();
}

/** Insert the seed subscriptions unconditionally. Used by tests + reset. */
export async function seedNow(): Promise<void> {
  const drafts = seedDrafts();
  for (const d of drafts) {
    await insertSubscription(d);
  }
}

export { seedDrafts } from '@/db/seed-data';