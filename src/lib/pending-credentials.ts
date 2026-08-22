/**
 * Pending credentials — device-local stash for a deferred email verification.
 *
 * When sign-up is deferred, the user enters the app on an anonymous session
 * right away and verifies their email later (Settings / dashboard banner).
 * Converting that anonymous user into their real account needs the email AND
 * password they signed up with, so both wait here — Keychain-backed via
 * expo-secure-store, never plain KV.
 *
 * Lifecycle:
 *   write  → deferred sign-up succeeds (anonymous session active)
 *   read   → "Verify now" converts the account (updateUser email+password)
 *   clear  → verified, or signed out / account deleted (the pending identity
 *            is abandoned; nothing was ever created server-side for it)
 *
 * NOTE: imports a native module — must not be imported from Jest-tested
 * modules. Tests inject doubles through `setAuthDeps`.
 */

import * as SecureStore from 'expo-secure-store';

const PENDING_KEY = 'subby.pendingVerification';

export interface PendingCredentials {
  email: string;
  password: string;
}

export async function readPendingCredentials(): Promise<PendingCredentials | null> {
  const raw = await SecureStore.getItemAsync(PENDING_KEY);
  if (!raw) return null;
  try {
    // SAFETY: only this module writes the key, always JSON of
    // PendingCredentials written by writePendingCredentials below.
    return JSON.parse(raw) as PendingCredentials;
  } catch {
    return null;
  }
}

export async function writePendingCredentials(
  creds: PendingCredentials,
): Promise<void> {
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(creds));
}

export async function clearPendingCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_KEY);
}
