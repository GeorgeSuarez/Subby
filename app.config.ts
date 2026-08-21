// oxlint-disable no-unsafe-dictionary-type, require-safety-comment-for-type-assertion
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config — wraps app.json and gates env-specific behavior.
 *
 * APP_VARIANT is set by eas.json (development/preview/production). In
 * production we must disable cleartext traffic (Play flags usesCleartextTraffic=true)
 * and keep demo-data disabled (ENABLE_DEMO_DATA). SCHEDULE_EXACT_ALARM was
 * removed entirely per store review decision — inexact reminders via
 * POST_NOTIFICATIONS only.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development';
  const isProd = variant === 'production';

  // Patch expo-build-properties to disable cleartext in production.
  // config.plugins comes from app.json; we clone and patch it.
  const plugins = (config.plugins as unknown[] | undefined)?.map((p) => {
    if (Array.isArray(p) && p[0] === 'expo-build-properties') {
      // SAFETY: app.json defines expo-build-properties as [name, opts]; we patch only the known shape
      const opts = (p[1] as Record<string, unknown>) ?? {};
      const android = (opts.android as Record<string, unknown>) ?? {};
      return [
        'expo-build-properties',
        {
          ...opts,
          android: {
            ...android,
            usesCleartextTraffic: isProd ? false : (android.usesCleartextTraffic as boolean) ?? true,
          },
        },
      ];
    }
    return p;
  });

  // SAFETY: app.json provides required expo fields (name/slug/version); dynamic config only patches plugins/cleartext
  return {
    ...config,
    plugins: plugins as ExpoConfig['plugins'],
  } as ExpoConfig;
};
