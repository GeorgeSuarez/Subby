/**
 * Demo data store — holds the demo-data status query result.
 *
 * One-shot DB read exposed to the Settings section. Keeping it in a store
 * (rather than local component state) matches the codebase pattern of calling
 * store actions from effects, and lets the info refresh from anywhere.
 *
 * Skill rules:
 *  - `react-state-minimize`: the store holds only the query result; the
 *    "is test account" rule lives in `isTestAccountEmail` and the seed
 *    functions re-verify it at the data layer.
 */

import { create } from 'zustand';

import { getDemoDataInfo, type DemoDataInfo } from '@/db/seed';

interface DemoDataStore {
  /** Query result; `null` until the first refresh completes. */
  info: DemoDataInfo | null;
  /** Re-run the status query for the given account email. */
  refresh: (email: string | null) => Promise<void>;
}

export const useDemoDataStore = create<DemoDataStore>()((set) => ({
  info: null,
  refresh: async (email) => {
    set({ info: await getDemoDataInfo(email) });
  },
}));
