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
 * Dependencies (Supabase client + local cache cleanup) are swappable via
 * `setAuthDeps` — the Jest tests install faithful doubles, and the offline
 * cleanup is required lazily so the store never drags native modules
 * (expo-sqlite) into a plain-node test environment.
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
import { AuthApiError } from '@supabase/supabase-js';
import type {
  AuthError,
  FunctionsError,
  Session,
  User,
  VerifyOtpParams,
} from '@supabase/supabase-js';

import {
  isSessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
} from '@/lib/session-errors';
import type { PendingCredentials } from '@/lib/pending-credentials';

export const NOT_CONFIGURED_MESSAGE =
  'Supabase is not configured — add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env';

/** Copy for a sign-up that collides with an existing account (either form:
 * the 422 error or the empty-identities obfuscation). */
export const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with this email already exists. Try signing in — if you signed up recently, confirm the link we emailed you first.';

/** Turn GoTrue rate-limit errors into copy a user can act on. */
function friendlyAuthError(error: Error): string {
  // GoTrue's resend/OTP 429s carry a generic `msg` ("For security purposes,
  // you can only request this after 0 seconds.") that matches no message
  // regex — classify by the structured error code first.
  if (error instanceof AuthApiError) {
    if (error.code === 'over_email_send_rate_limit') {
      return 'Too many emails sent — please wait about an hour and try again.';
    }
    if (error.code === 'user_already_exists') {
      return DUPLICATE_ACCOUNT_MESSAGE;
    }
    if (error.code === 'over_request_rate_limit') {
      return 'Too many attempts — please wait a moment and try again.';
    }
  }
  const message = error.message;
  if (/email rate limit|over_email_send_rate_limit/i.test(message)) {
    return 'Too many emails sent — please wait about an hour and try again.';
  }
  if (/too many requests|rate limit/i.test(message)) {
    return 'Too many attempts — please wait a moment and try again.';
  }
  if (/already registered|already exists|email exists/i.test(message)) {
    return DUPLICATE_ACCOUNT_MESSAGE;
  }
  return message;
}

interface AuthStore {
  isSignedIn: boolean;
  /** Email of the signed-in user, shown in Settings. */
  email: string | null;
  /** Supabase user id of the signed-in user (keys offline cache/queue). */
  userId: string | null;
  /** True until the initial session restore settles. */
  isLoading: boolean;
  /** Last auth failure message (cleared on the next attempt). */
  error: string | null;
  /** Email awaiting email confirmation — drives the verify-email screen. */
  verificationEmail: string | null;
  /**
   * True while the active session belongs to an anonymous user bridging a
   * deferred email verification (sign-up let them straight in).
   */
  isAnonymous: boolean;
  /**
   * Email awaiting deferred verification for the anonymous bridge account.
   * Null when nothing is pending. Backed device-side by the pending
   * credentials needed to convert the account (`src/lib/pending-credentials`).
   */
  pendingVerificationEmail: string | null;
  /**
   * True once the conversion email went out for the pending account (the
   * sign-up auto-send or a later manual send). Lets the Verify screen skip
   * its intro straight to the "check your inbox" phase.
   */
  verificationEmailSent: boolean;
  /**
   * True while a password-recovery session is active (PASSWORD_RECOVERY
   * event or a recovery code/link verified). Drives the reset screen.
   */
  recoveryPending: boolean;
  /** Email the recovery code was sent to — prefills the reset screen. */
  recoveryEmail: string | null;
  /** Internal: initialize() ran (idempotency guard). */
  hasInitialized: boolean;
  /** Restore the persisted session + subscribe to auth changes. Idempotent. */
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    emailRedirectTo?: string,
  ) => Promise<void>;
  /** Re-send the confirmation link to `verificationEmail`. */
  resendVerificationEmail: () => Promise<void>;
  /**
   * Send the confirmation email that converts the anonymous bridge account
   * into a real one (updateUser with the stashed sign-up credentials).
   * Throws when the pending credentials are gone (e.g. Keychain cleared) so
   * the UI can ask the user to sign up again.
   */
  beginAccountVerification: () => Promise<void>;
  /**
   * True once the confirmation landed — the user's email matches the pending
   * address and is confirmed. Clears the pending state on success.
   */
  checkAccountVerified: () => Promise<boolean>;
  /** True once the email is confirmed (a session exists); mirrors it. */
  checkVerification: () => Promise<boolean>;
  /** Send the password-reset email. `redirectTo` must be allow-listed. */
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  /**
   * Consume a recovery deep link (`#access_token=…&type=recovery`) by setting
   * the session it carries. supabase-js's detectSessionInUrl only works in
   * browsers, so RN apps must parse the URL themselves. Returns true when the
   * URL carried a usable recovery session.
   */
  handleAuthUrl: (url: string) => Promise<boolean>;
  /** Verify a recovery link (paste fallback for dev) and open a session. */
  verifyRecoveryLink: (link: string) => Promise<void>;
  /** Verify the 6-digit recovery code from the email and open a session. */
  verifyRecoveryCode: (email: string, code: string) => Promise<void>;
  /** Set a new password with the active (recovery) session. */
  updatePassword: (password: string) => Promise<void>;
  /**
   * Verify the signed-in user's current password (identity check before the
   * change flow). Throws 'Current password is incorrect.' on failure.
   */
  verifyCurrentPassword: (currentPassword: string) => Promise<void>;
  /**
   * Permanently delete the account server-side (Edge Function) and clear all
   * local data for it. Throws on failure so the UI can surface the error.
   */
  deleteAccount: () => Promise<void>;
  /** Drop the recovery state (e.g. leaving the reset screen). */
  clearRecovery: () => void;
  /**
   * Sign out because the server-side session died (user deleted, tokens
   * revoked). `message` is surfaced on the sign-in screen.
   */
  expireSession: (message: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// --- Dependencies -----------------------------------------------------------

/** The Supabase surface the auth store drives (a subset of SupabaseClient). */
export interface AuthSupabase {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null } }>;
    onAuthStateChange: (
      callback: (event: string, session: Session | null) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data: { session: Session | null };
      error: AuthError | null;
    }>;
    signInAnonymously: () => Promise<{
      data: { session: Session | null };
      error: AuthError | null;
    }>;
    getUser: () => Promise<{
      data: { user: User | null };
      error: AuthError | null;
    }>;
    signUp: (credentials: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string };
    }) => Promise<{
      data: { session: Session | null; user: User | null };
      error: AuthError | null;
    }>;
    resend: (options: {
      type: 'signup';
      email: string;
    }) => Promise<{ error: AuthError | null }>;
    resetPasswordForEmail: (
      email: string,
      options: { redirectTo?: string },
    ) => Promise<{ error: AuthError | null }>;
    verifyOtp: (params: VerifyOtpParams) => Promise<{
      data: { session: Session | null };
      error: AuthError | null;
    }>;
    setSession: (params: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{
      data: { session: Session | null };
      error: AuthError | null;
    }>;
    updateUser: (attributes: {
      password: string;
      /** Present when converting an anonymous bridge account to a real one. */
      email?: string;
    }) => Promise<{ data: { user: User | null }; error: AuthError | null }>;
    signOut: () => Promise<{ error: AuthError | null }>;
  };
  functions: {
    invoke: (functionName: string) => Promise<{ error: FunctionsError | null }>;
  };
}

/** Everything the auth store needs from the outside world. */
export interface AuthDeps {
  isSupabaseConfigured: boolean;
  supabase: AuthSupabase;
  clearCacheForUser: (userId: string) => Promise<void>;
  clearQueueForUser: (userId: string) => Promise<void>;
  /** Stash/read/drop the deferred sign-up credentials (Keychain-backed). */
  writePendingCredentials: (creds: PendingCredentials) => Promise<void>;
  readPendingCredentials: () => Promise<PendingCredentials | null>;
  clearPendingCredentials: () => Promise<void>;
}

let deps: AuthDeps | null = null;

/**
 * Build the production wiring. Lazy `require` keeps the native modules
 * (expo-secure-store via the Supabase client, expo-sqlite via the sync
 * coordinator) out of the plain-node Jest env; Metro bundles the literal
 * requires statically.
 */
function buildDefaultDeps(): AuthDeps {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isSupabaseConfigured, supabase } = require('@/lib/supabase');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pending = require('@/lib/pending-credentials');
  return {
    isSupabaseConfigured,
    supabase,
    clearCacheForUser: (userId) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/db/offline').clearCacheForUser(userId),
    clearQueueForUser: (userId) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/db/offline').clearQueueForUser(userId),
    writePendingCredentials: (creds) => pending.writePendingCredentials(creds),
    readPendingCredentials: () => pending.readPendingCredentials(),
    clearPendingCredentials: () => pending.clearPendingCredentials(),
  };
}

function currentDeps(): AuthDeps {
  if (deps === null) deps = buildDefaultDeps();
  return deps;
}

/**
 * Swap the auth store's external dependencies (test seam). Returns the
 * previously installed set (or `null` before the first swap) so callers can
 * restore it. Passing `null` restores the production wiring.
 */
export function setAuthDeps(next: AuthDeps | null): AuthDeps | null {
  const previous = deps;
  deps = next;
  return previous;
}

let unsubscribeAuth: (() => void) | null = null;

/**
 * Fire the conversion email for an anonymous bridge account (updateUser with
 * its stashed credentials). Returns true when GoTrue accepted the send.
 */
async function sendConversionEmail(
  creds: PendingCredentials,
): Promise<boolean> {
  const { error } = await currentDeps().supabase.auth.updateUser({
    email: creds.email,
    password: creds.password,
  });
  return error === null;
}

/** Extract the one-time recovery token from a pasted reset link. */
export function parseRecoveryToken(link: string): string | null {
  const m = /[?&]token=([^&#]+)/.exec(link);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** Decode the `sub` claim from a JWT (e.g. the recovery link's session). */
function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    // escape/unescape keep UTF-8 JSON parseable from atob's latin1 output.
    const json = decodeURIComponent(escape(atob(b64)));
    // SAFETY: the payload is base64-encoded JSON; only the optional `sub`
    // claim is read, and it is null-guarded by the caller.
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

/**
 * The single error contract for user-invoked auth actions: record the failure
 * on `store.error` (friendly copy) and return a throwable Error, so callers
 * always see one pattern — catch the throw, show `e.message`. `handleAuthUrl`
 * is the documented exception (event-handler seam: returns boolean, never
 * throws).
 */
function failAuthAction(
  set: (partial: Partial<AuthStore>) => void,
  error: Error,
): Error {
  const message = friendlyAuthError(error);
  set({ isLoading: false, error: message });
  return new Error(message);
}

/** Local session teardown shared by sign-out and expire-session. */
function clearLocalSession(
  set: (partial: Partial<AuthStore>) => void,
  message?: string,
): void {
  applySession(null);
  // The pending identity dies with the session — drop its credentials too.
  void currentDeps()
    .clearPendingCredentials()
    .catch(() => {
      // Nothing to clean up or storage unavailable — either way move on.
    });
  set({
    recoveryPending: false,
    recoveryEmail: null,
    pendingVerificationEmail: null,
    verificationEmailSent: false,
    ...(message ? { error: message } : null),
  });
}

/** Mirror a session into the store. */
function applySession(session: Session | null): void {
  useAuthStore.setState({
    isSignedIn: Boolean(session),
    email: session?.user.email ?? null,
    userId: session?.user.id ?? null,
    isAnonymous: session?.user.is_anonymous === true,
    isLoading: false,
    error: null,
    verificationEmail: null,
  });
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  isSignedIn: false,
  email: null,
  userId: null,
  isAnonymous: false,
  isLoading: true,
  error: null,
  verificationEmail: null,
  pendingVerificationEmail: null,
  verificationEmailSent: false,
  recoveryPending: false,
  recoveryEmail: null,
  hasInitialized: false,

  initialize: async () => {
    if (get().hasInitialized) return;

    if (!currentDeps().isSupabaseConfigured) {
      set({ isLoading: false, hasInitialized: true });
      return;
    }

    const { data } = await currentDeps().supabase.auth.getSession();
    applySession(data.session);

    // Deferred verification survives restarts: an anonymous bridge session
    // rehydrates its pending email from the Keychain stash. A non-anonymous
    // session means conversion already happened — self-heal any stale file.
    if (data.session?.user.is_anonymous === true) {
      const creds = await currentDeps().readPendingCredentials();
      // Send state is unknown after a restart — the Verify screen falls back
      // to its intro (a manual send is harmless; GoTrue rate-limits repeats).
      if (creds?.email) {
        set({
          pendingVerificationEmail: creds.email,
          verificationEmailSent: false,
        });
      }
    } else {
      await currentDeps()
        .clearPendingCredentials()
        .catch(() => {});
    }

    unsubscribeAuth?.();
    const { data: subscription } =
      currentDeps().supabase.auth.onAuthStateChange((event, session) => {
        applySession(session);
        // A recovery link opens the app with a fresh session — the reset
        // screen keys off this flag to show the password form.
        if (event === 'PASSWORD_RECOVERY') {
          set({ recoveryPending: true });
        }
      });
    unsubscribeAuth = subscription.subscription.unsubscribe;

    set({ hasInitialized: true });
  },

  signIn: async (email, password) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    set({ isLoading: true, error: null });
    const { data, error } =
      await currentDeps().supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    if (error) {
      throw failAuthAction(set, error);
    }
    applySession(data.session);
  },

  signUp: async (email, password, emailRedirectTo) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    set({ isLoading: true, error: null });
    const { data, error } = await currentDeps().supabase.auth.signUp({
      email: email.trim(),
      password,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : null),
    });
    if (error) {
      throw failAuthAction(set, error);
    }
    // Duplicate sign-up guard: for an email that already exists GoTrue
    // returns HTTP 200 with an empty `identities` array (anti-enumeration
    // obfuscation). Treating that as a fresh sign-up would bridge onto an
    // anonymous session whose credentials can never convert — stop here
    // instead and point the user at sign-in / their confirmation email.
    if (
      data.session === null &&
      data.user !== null &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      set({ isLoading: false });
      throw new Error(DUPLICATE_ACCOUNT_MESSAGE);
    }
    if (data.session) {
      applySession(data.session);
    } else {
      // Email confirmation is enabled — GoTrue created the user but holds
      // the session until the link is clicked, and sign-in is blocked for
      // unconfirmed emails. Defer instead of blocking: bridge onto an
      // anonymous session so the app is usable immediately, stash the
      // sign-up credentials for the later conversion, and let Settings / the
      // dashboard banner drive verification. Falls back to the legacy
      // blocking verify screen when anonymous sign-ins are unavailable.
      try {
        const anon = await currentDeps().supabase.auth.signInAnonymously();
        if (anon.error || !anon.data.session) {
          throw anon.error ?? new Error('Anonymous sign-in unavailable');
        }
        await currentDeps().writePendingCredentials({
          email: email.trim(),
          password,
        });
        applySession(anon.data.session);
        set({
          isLoading: false,
          error: null,
          pendingVerificationEmail: email.trim(),
          verificationEmailSent: false,
        });
        // Pre-fill the inbox: fire the conversion email right away so the
        // confirmation is waiting instead of a cold "Send" button. Best-
        // effort — failure just means the banner / Verify screen resend.
        const creds = { email: email.trim(), password } as const;
        void sendConversionEmail(creds)
          .then((sent) => {
            const state = useAuthStore.getState();
            // Flag only if nothing changed mid-flight (still signed in on the
            // same anonymous bridge, still the same pending address).
            if (
              sent &&
              state.isSignedIn &&
              state.isAnonymous &&
              state.pendingVerificationEmail === creds.email
            ) {
              useAuthStore.setState({ verificationEmailSent: true });
            }
          })
          .catch(() => {
            // Offline / rate-limited — resurfaced by the manual send path.
          });
      } catch {
        set({
          isLoading: false,
          error: null,
          verificationEmail: email.trim(),
        });
      }
    }
  },

  resendVerificationEmail: async () => {
    const email = get().verificationEmail;
    if (!email) throw new Error('No email awaiting verification.');
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const { error } = await currentDeps().supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw failAuthAction(set, error);
  },

  beginAccountVerification: async () => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const creds = await currentDeps().readPendingCredentials();
    if (!creds) {
      // The Keychain stash is gone (cleared storage, OS cleanup). The
      // anonymous account can't be converted without its credentials.
      throw new Error(
        'Sign-up details are missing on this device — create the account again.',
      );
    }
    set({ isLoading: true, error: null });
    // Converts the anonymous user in place: same uid, so subscriptions,
    // prefs, and the offline queue all stay valid. GoTrue emails a
    // confirmation to the address; checkAccountVerified polls for it.
    const { error } = await currentDeps().supabase.auth.updateUser({
      email: creds.email,
      password: creds.password,
    });
    if (error) {
      if (isSessionExpiredError(error)) {
        await get().expireSession(SESSION_EXPIRED_MESSAGE);
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }
      throw failAuthAction(set, error);
    }
    set({ isLoading: false, error: null, verificationEmailSent: true });
  },

  checkAccountVerified: async () => {
    if (!currentDeps().isSupabaseConfigured) return false;
    const pending = get().pendingVerificationEmail;
    if (pending === null) return true;
    const { data, error } = await currentDeps().supabase.auth.getUser();
    if (error || !data.user) return false;
    const confirmedAt = data.user.email_confirmed_at ?? data.user.confirmed_at;
    if (data.user.email !== pending || !confirmedAt) return false;
    // Conversion landed — drop the stash and mirror the now-real account.
    await currentDeps()
      .clearPendingCredentials()
      .catch(() => {});
    set({
      email: data.user.email ?? pending,
      isAnonymous: data.user.is_anonymous === true,
      pendingVerificationEmail: null,
      verificationEmailSent: false,
      isLoading: false,
      error: null,
    });
    return true;
  },

  checkVerification: async () => {
    if (!currentDeps().isSupabaseConfigured) return false;
    const { data } = await currentDeps().supabase.auth.getSession();
    if (data.session) {
      applySession(data.session);
      return true;
    }
    return false;
  },

  requestPasswordReset: async (email, redirectTo) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    set({ isLoading: true, error: null });
    const { error } = await currentDeps().supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );
    if (error) {
      throw failAuthAction(set, error);
    }
    set({ isLoading: false, recoveryEmail: email.trim() });
  },

  verifyRecoveryCode: async (email, code) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    set({ isLoading: true, error: null });
    const { data, error } = await currentDeps().supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (error) {
      throw failAuthAction(set, error);
    }
    applySession(data.session);
    set({ recoveryPending: true, recoveryEmail: email.trim() });
  },

  handleAuthUrl: async (url) => {
    if (!currentDeps().isSupabaseConfigured) return false;
    const params = new URLSearchParams(
      (url.split('#')[1] ?? url.split('?')[1] ?? '').toString(),
    );
    if (params.get('type') !== 'recovery') return false;
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return false;

    // Never feed stale link tokens into setSession over a live session:
    // supabase-js removes the stored session when _getUser fails with
    // "Auth session missing" (revoked/rotated/expired link session) — the
    // next updateUser then fails with "Auth session missing!". If the link
    // belongs to the signed-in user, the existing session IS the recovery
    // grant; otherwise ignore it.
    const { data: current } = await currentDeps().supabase.auth.getSession();
    if (current.session) {
      if (decodeJwtSub(accessToken) === current.session.user.id) {
        set({ recoveryPending: true });
        return true;
      }
      return false;
    }

    const { error } = await currentDeps().supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      set({ error: friendlyAuthError(error) });
      return false;
    }
    // setSession emits SIGNED_IN (handled above); the recovery flag drives
    // the reset screen's password form.
    set({ recoveryPending: true });
    return true;
  },

  verifyRecoveryLink: async (link) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const token = parseRecoveryToken(link);
    if (!token)
      throw new Error('That link does not look like a password reset link.');
    set({ isLoading: true, error: null });
    // Email links carry the hashed token in `token` — verifyOtp's token_hash
    // variant is the API for it (no email needed for recovery).
    const { data, error } = await currentDeps().supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });
    if (error) {
      throw failAuthAction(set, error);
    }
    applySession(data.session);
    set({ recoveryPending: true });
  },

  updatePassword: async (password) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    set({ isLoading: true, error: null });
    const { data, error } = await currentDeps().supabase.auth.updateUser({
      password,
    });
    if (error) {
      if (isSessionExpiredError(error)) {
        await get().expireSession(SESSION_EXPIRED_MESSAGE);
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }
      throw failAuthAction(set, error);
    }
    // updateUser returns the user, not a session — the recovery session stays.
    set({
      isSignedIn: true,
      email: data.user?.email ?? get().email,
      isLoading: false,
      error: null,
      recoveryPending: false,
    });
  },

  verifyCurrentPassword: async (currentPassword) => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    set({ isLoading: true, error: null });
    const email = get().email;
    if (!email) {
      throw failAuthAction(set, new Error('No signed-in account.'));
    }
    const { error } = await currentDeps().supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (error) {
      // The verify step hides the raw credential error behind one message.
      set({ isLoading: false, error: 'Current password is incorrect.' });
      throw new Error('Current password is incorrect.');
    }
    // signInWithPassword refreshed the session — the change screen can now
    // call updateUser directly.
    set({ isLoading: false, error: null });
  },

  clearRecovery: () => set({ recoveryPending: false }),

  deleteAccount: async () => {
    if (!currentDeps().isSupabaseConfigured) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
    const userId = get().userId;
    if (!userId) throw failAuthAction(set, new Error('No signed-in account.'));
    set({ isLoading: true, error: null });
    const { error } =
      await currentDeps().supabase.functions.invoke('delete-account');
    if (error) {
      throw failAuthAction(set, error);
    }
    // Account is gone server-side — wipe everything local and sign out.
    await currentDeps().clearCacheForUser(userId);
    await currentDeps().clearQueueForUser(userId);
    await currentDeps()
      .clearPendingCredentials()
      .catch(() => {});
    if (currentDeps().isSupabaseConfigured) {
      await currentDeps().supabase.auth.signOut();
    }
    applySession(null);
    set({
      recoveryPending: false,
      recoveryEmail: null,
      pendingVerificationEmail: null,
      verificationEmailSent: false,
      isLoading: false,
    });
  },

  expireSession: async (message) => {
    if (currentDeps().isSupabaseConfigured) {
      await currentDeps()
        .supabase.auth.signOut()
        .catch(() => {
          // Local-only sign-out is fine — the server session is already dead.
        });
    }
    clearLocalSession(set, message);
  },

  signOut: async () => {
    if (currentDeps().isSupabaseConfigured) {
      await currentDeps().supabase.auth.signOut();
    }
    clearLocalSession(set);
  },
}));
