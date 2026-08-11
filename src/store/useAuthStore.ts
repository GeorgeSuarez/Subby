/**
 * Auth store — mock authentication for the sign-in / sign-up flow.
 *
 * This is a UI mock: there is no backend. `signIn` / `signUp` simulate network
 * latency, then flip `isSignedIn` and remember the email entered so Settings
 * can show "Signed in as …". `signOut` clears the session and the root layout's
 * `Stack.Protected` guard flips back to the auth stack.
 *
 * The session (signed-in flag + email) IS persisted via `persistentStorage`,
 * so a restart keeps the user signed in — matching how a real app would
 * restore a session from a stored token. When a real backend lands, replace
 * this mock with `expo-secure-store` for the auth token and derive
 * `isSignedIn` from its presence; never store passwords or tokens in plain KV.
 *
 * Skill rules:
 *  - `react-state-minimize`: the store holds only session facts; everything
 *    else (routes, UI states) is derived from `isSignedIn`.
 *  - `react-state-dispatcher`: mutations go through store actions only.
 *  - `react-state-fallback`: rehydration is async; until it resolves the
 *    default (signed out) state applies, so the auth gate never flashes
 *    signed-in content on a cold start.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { persistentStorage, storageKey } from '@/design/storage';

/** Simulated network latency so the CTA's disabled state is visible. */
const MOCK_LATENCY_MS = 600;

interface AuthStore {
  isSignedIn: boolean;
  /** Email entered at sign-in/sign-up, shown in Settings. */
  email: string | null;
  signIn: (email: string) => Promise<void>;
  signUp: (email: string) => Promise<void>;
  signOut: () => void;
}

function mockLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isSignedIn: false,
      email: null,
      signIn: async (email) => {
        await mockLatency();
        set({ isSignedIn: true, email: email.trim() });
      },
      signUp: async (email) => {
        await mockLatency();
        set({ isSignedIn: true, email: email.trim() });
      },
      signOut: () => set({ isSignedIn: false, email: null }),
    }),
    {
      name: storageKey.auth,
      storage: createJSONStorage(() => persistentStorage),
      // Persist only the session facts — never the actions.
      partialize: (s): { isSignedIn: boolean; email: string | null } => ({
        isSignedIn: s.isSignedIn,
        email: s.email,
      }),
    },
  ),
);
