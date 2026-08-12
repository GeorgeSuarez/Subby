/**
 * Supabase client + session storage.
 *
 * The client is created from public env vars (`EXPO_PUBLIC_SUPABASE_URL`,
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` — both safe to ship in the bundle). Sessions
 * persist in the device Keychain via `expo-secure-store`, never in plain KV.
 *
 * `isSupabaseConfigured` is false while the placeholders are in place, which
 * the auth store uses to surface a clear "not configured" error instead of
 * mysterious network failures.
 *
 * NOTE: importing this module pulls in native modules, so it must not be
 * imported from Jest-tested modules.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once real (non-placeholder) credentials are configured. */
export const isSupabaseConfigured: boolean =
  SUPABASE_URL.length > 0 &&
  SUPABASE_ANON_KEY.length > 0 &&
  SUPABASE_URL !== PLACEHOLDER_URL &&
  SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

const SESSION_KEY = 'subby.supabase.session';

/** Keychain-backed storage adapter for Supabase's auth session. */
const secureStorage = {
  getItem: async (key: string): Promise<string | null> =>
    SecureStore.getItemAsync(key === 'supabase.auth.token' ? SESSION_KEY : key),
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key === 'supabase.auth.token' ? SESSION_KEY : key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key === 'supabase.auth.token' ? SESSION_KEY : key);
  },
};

/**
 * The app-wide Supabase client. Created eagerly so the auth store can call it
 * from anywhere; all methods reject cleanly when unconfigured.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
