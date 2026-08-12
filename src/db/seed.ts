/**
 * Demo (seeded) data manager.
 *
 * Seeded rows are marked with the `seeded` column and are filtered out of
 * every read for any account other than the test account. Rows are owned by
 * the signed-in user (RLS), so the marker is about demo-data lifecycle, not
 * cross-account visibility.
 *
 * THE RULE: every mutation here is guarded by `isTestAccountEmail` — only the
 * test account (`test@subby.app`) may load or remove demo data. The guard is
 * enforced at the data layer (not just the UI), so no other account can
 * trigger a seed through any code path.
 *
 * The pure draft list lives in `seed-data.ts` (no DB imports) so it is fully
 * testable in plain Node Jest.
 */

import { insertSubscription } from '@/db/queries';
import { seedDrafts } from '@/db/seed-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { isTestAccountEmail } from '@/utils/constants';

export type DemoActionResult = 'done' | 'nothingToDo' | 'denied';

async function countSeededRows(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('seeded', true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Read-only status used by the Settings "Demo data" section. */
export interface DemoDataInfo {
  /** Is the current account the test account (allowed to use demo data)? */
  isAllowed: boolean;
  /** Are any seeded rows present? */
  loaded: boolean;
  /** Number of seeded rows. */
  count: number;
}

export async function getDemoDataInfo(email: string | null): Promise<DemoDataInfo> {
  if (!isTestAccountEmail(email)) {
    return { isAllowed: false, loaded: false, count: 0 };
  }
  const count = await countSeededRows();
  return { isAllowed: true, loaded: count > 0, count };
}

/**
 * Load the seed set — but ONLY for the test account, and only once (rows are
 * marked `seeded = true`, so a second run is a no-op and rows are never
 * duplicated). Returns 'denied' for any other account.
 */
export async function loadSeedData(email: string | null): Promise<DemoActionResult> {
  if (!isTestAccountEmail(email)) return 'denied';

  if ((await countSeededRows()) > 0) return 'nothingToDo';

  for (const draft of seedDrafts()) {
    await insertSubscription(draft, { seeded: true });
  }
  return 'done';
}

/**
 * Remove exactly the seeded rows — ONLY for the test account.
 * Returns 'denied' for any other account.
 */
export async function removeSeedData(email: string | null): Promise<DemoActionResult> {
  if (!isTestAccountEmail(email)) return 'denied';

  if ((await countSeededRows()) === 0) return 'nothingToDo';

  const { error } = await supabase.from('subscriptions').delete().eq('seeded', true);
  if (error) throw new Error(error.message);
  return 'done';
}

export { seedDrafts } from '@/db/seed-data';
