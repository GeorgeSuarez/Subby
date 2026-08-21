/**
 * Platform-aware local auth redirect URLs.
 *
 * The Android emulator cannot reach the host Mac through 127.0.0.1. It uses
 * 10.0.2.2 instead, while the iOS simulator can keep using loopback. A
 * physical Android device can override the host with EXPO_PUBLIC_DEV_HOST.
 */

import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

import { SUPABASE_URL } from '@/lib/supabase';

const LOCAL_SUPABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '10.0.2.2']);

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function isLocalSupabaseUrl(value: string): boolean {
  const host = hostFromUrl(value);
  const explicitHost = process.env.EXPO_PUBLIC_DEV_HOST?.trim();
  return (
    host !== null && (LOCAL_SUPABASE_HOSTS.has(host) || host === explicitHost)
  );
}

/** Host address visible from the current device/emulator. */
export function localDevHost(): string {
  const explicit = process.env.EXPO_PUBLIC_DEV_HOST?.trim();
  if (explicit) return explicit;
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

/**
 * Redirect auth emails to the local handoff page in local development, or to
 * the stable app scheme in a development/preview/production build.
 */
export function authRedirectUrl(path = ''): string {
  if (!isLocalSupabaseUrl(SUPABASE_URL)) {
    return Linking.createURL(path);
  }
  const suffix = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `http://${localDevHost()}:3000${suffix}`;
}
