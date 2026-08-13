import type { StateStorage } from 'zustand/middleware';

/**
 * Persistent storage adapter for Zustand `persist` middleware.
 *
 * Layers, in order:
 *  1. web     → browser `localStorage` (react-native-web).
 *  2. native  → `expo-sqlite/kv-store` (AsyncStorage-compatible KV store backed
 *     by an on-device SQLite database — zero new dependencies, survives
 *     restarts, and is included in device backups).
 *  3. fallback → in-memory Map (unit tests / exotic platforms where the
 *     native module can't load). Degrades gracefully per skill rule
 *     `react-state-fallback`: a read failure just returns `null`.
 *
 * Deliberately framework-free: no `react-native` imports, so this module can
 * be loaded by the plain-node Jest environment (which can't transform
 * `react-native`'s flow-typed sources). Web detection relies on `localStorage`
 * existing — true in browsers, false in Hermes and node-Jest.
 *
 * The native module is loaded lazily inside try/catch with a literal `require`
 * path: Metro statically bundles it, while Jest falls back to memory.
 */

const memory = new Map<string, string>();

/** In-memory fallback (also the pre-persistence v1 adapter). */
export const memoryStorage: StateStorage = {
  getItem: (name) => memory.get(name) ?? null,
  setItem: (name, value) => {
    memory.set(name, value);
  },
  removeItem: (name) => {
    memory.delete(name);
  },
};

/** Browser localStorage adapter — sync, mirrors the `StateStorage` shape. */
const webStorage: StateStorage = {
  getItem: (name) => globalThis.localStorage.getItem(name),
  setItem: (name, value) => {
    globalThis.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    globalThis.localStorage.removeItem(name);
  },
};

let sqliteStoragePromise: Promise<StateStorage | null> | undefined;

/** Lazily resolve the SQLite-backed store; `null` when unavailable (Jest). */
function getSqliteStorage(): Promise<StateStorage | null> {
  if (sqliteStoragePromise === undefined) {
    sqliteStoragePromise = (async () => {
      try {
        // Deliberate `require` (not dynamic `import`): Metro bundles literal
        // requires statically, and Jest's plain-node env can't load this
        // module at all (the try/catch falls back to memory).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { default: AsyncStorage } =
          require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store');
        return {
          getItem: (name) => AsyncStorage.getItemAsync(name),
          setItem: (name, value) => AsyncStorage.setItemAsync(name, value),
          removeItem: (name) => AsyncStorage.removeItemAsync(name),
        };
      } catch {
        return null;
      }
    })();
  }
  return sqliteStoragePromise;
}

/** True in browsers / react-native-web; false on Hermes and in node-Jest. */
const isWeb = typeof globalThis.localStorage !== 'undefined';

/** Shared storage instance for all persisted Zustand stores. */
export const persistentStorage: StateStorage = {
  getItem: async (name) => {
    if (isWeb) return webStorage.getItem(name);
    const sqlite = await getSqliteStorage();
    return sqlite ? sqlite.getItem(name) : memoryStorage.getItem(name);
  },
  setItem: async (name, value) => {
    if (isWeb) {
      webStorage.setItem(name, value);
      return;
    }
    const sqlite = await getSqliteStorage();
    if (sqlite) {
      await sqlite.setItem(name, value);
    } else {
      memoryStorage.setItem(name, value);
    }
  },
  removeItem: async (name) => {
    if (isWeb) {
      webStorage.removeItem(name);
      return;
    }
    const sqlite = await getSqliteStorage();
    if (sqlite) {
      await sqlite.removeItem(name);
    } else {
      memoryStorage.removeItem(name);
    }
  },
};

/** Storage keys — distinct per store; namespaced with the app slug. */
export const storageKey = {
  themePref: 'subby.themePref',
} as const;
