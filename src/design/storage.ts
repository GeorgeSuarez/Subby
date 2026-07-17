import { Platform } from 'react-native';

/**
 * Minimal in-memory storage adapter for Zustand `persist` middleware.
 *
 * For v1 scaffolding we don't pull in AsyncStorage/MMKV yet (Step 4 will swap
 * in `@react-native-async-storage/async-storage`). The shape of this adapter
 * matches the `StateStorage` interface, so swapping later is a one-line change.
 *
 * Skill rule `react-state-fallback`: storage failures degrade gracefully — a
 * read failure just returns `null`, so the store falls back to its defaults.
 */

const memory = new Map<string, string>();

export const memoryStorage: {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
} = {
  getItem: (name) => memory.get(name) ?? null,
  setItem: (name, value) => {
    memory.set(name, value);
  },
  removeItem: (name) => {
    memory.delete(name);
  },
};

/** Prefix keys to avoid collisions when we migrate to AsyncStorage. */
export const storageKey = {
  themePref: Platform.select({ ios: 'subby.ios.themePref', default: 'subby.themePref' }),
} as const;