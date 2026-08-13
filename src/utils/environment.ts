/**
 * Environment capabilities.
 *
 * Demo/test-account features (auto-seed on sign-in, the Settings demo-data
 * section, the danger zone) are for development only — they are compiled out
 * of production EAS builds where `__DEV__` is false. Set
 * `EXPO_PUBLIC_ENABLE_DEMO=1` to force them on (or `0` to force them off).
 */

const explicit = process.env.EXPO_PUBLIC_ENABLE_DEMO;

export const ENABLE_DEMO_DATA: boolean =
  explicit === '1' ? true : explicit === '0' ? false : __DEV__;
