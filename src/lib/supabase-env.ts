const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

type NativePlatform = string;

/**
 * Make a local Supabase URL reachable from the current native device.
 *
 * Android emulators address the host machine as 10.0.2.2, not 127.0.0.1.
 * Physical devices can pass their LAN host through EXPO_PUBLIC_DEV_HOST.
 * Hosted HTTPS URLs and iOS loopback URLs are left unchanged.
 */
export function supabaseUrlForPlatform(
  rawUrl: string,
  platform: NativePlatform,
  deviceHost = process.env.EXPO_PUBLIC_DEV_HOST,
): string {
  if (platform !== 'android') return rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return rawUrl;

  const host = deviceHost?.trim() || '10.0.2.2';
  parsed.hostname = host;
  return parsed.toString().replace(/\/$/, '');
}
