/**
 * Auth store — Supabase-backed session state.
 *
 * The session is owned by Supabase (persisted in the device Keychain via
 * `expo-secure-store`). This store mirrors session facts for the UI: the root
 * layout's `Stack.Protected` gate, Settings' account row, and the auth
 * screens all derive from `isSignedIn` / `email`.
 *
 * `initialize()` restores the session on boot and subscribes to
 * `onAuthStateChange` so sign-in/out/session-refresh events flow into the
 * store automatically. Until real credentials exist in `.env`, the actions
 * throw a clear "not configured" error the form surfaces inline.
 *
 * Skill rules:
 *  - `react-state-minimize`: only session facts live here; everything else is
 *    derived.
 *  - `react-state-dispatcher`: mutations go through store actions only.
 *  - `react-state-fallback`: `isLoading` starts true and clears when the
 *    initial session restore settles, so the gate never flashes signed-in
 *    content on a cold start.
 */

import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const NOT_CONFIGURED_MESSAGE =
  'Supabase is not configured — add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env';

interface AuthStore {
  isSignedIn: boolean;
  /** Email of the signed-in user, shown in Settings. */
  email: string | null;
  /** True until the initial session restore settles. */
  isLoading: boolean;
  /** Last auth failure message (cleared on the next attempt). */
  error: string | null;
  /** Email awaiting email confirmation — drives the verify-email screen. */
  verificationEmail: string | null;
  /** Internal: initialize() ran (idempotency guard). */
  hasInitialized: boolean;
  /** Restore the persisted session + subscribe to auth changes. Idempotent. */
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  /** Re-send the confirmation link to `verificationEmail`. */
  resendVerificationEmail: () => Promise<void>;
  /** True once the email is confirmed (a session exists); mirrors it. */
  checkVerification: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

let unsubscribeAuth: (() => void) | null = null;

/** Mirror a session into the store. */
function applySession(session: Session | null): void {
  useAuthStore.setState({
    isSignedIn: Boolean(session),
    email: session?.user.email ?? null,
    isLoading: false,
    error: null,
    verificationEmail: null,
  });
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  isSignedIn: false,
  email: null,
  isLoading: true,
  error: null,
  verificationEmail: null,
  hasInitialized: false,

  initialize: async () => {
    if (get().hasInitialized) return;

    if (!isSupabaseConfigured) {
      set({ isLoading: false, hasInitialized: true });
      return;
    }

    const { data } = await supabase.auth.getSession();
    applySession(data.session);

    unsubscribeAuth?.();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    unsubscribeAuth = subscription.subscription.unsubscribe;

    set({ hasInitialized: true });
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED_MESSAGE);
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      throw new Error(error.message);
    }
    applySession(data.session);
  },

  signUp: async (email, password) => {
    if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED_MESSAGE);
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      throw new Error(error.message);
    }
    if (data.session) {
      applySession(data.session);
    } else {
      // Email confirmation is enabled — no session until the link is clicked.
      // Hand the sign-up over to the verify-email screen.
      set({
        isLoading: false,
        error: null,
        verificationEmail: email.trim(),
      });
    }
  },

  resendVerificationEmail: async () => {
    const email = get().verificationEmail;
    if (!email) throw new Error('No email awaiting verification.');
    if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED_MESSAGE);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
  },

  checkVerification: async () => {
    if (!isSupabaseConfigured) return false;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      applySession(data.session);
      return true;
    }
    return false;
  },

  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    applySession(null);
  },
}));
