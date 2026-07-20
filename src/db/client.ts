 /**
 * SQLite client + migration runner.
 *
 * Owns the singleton `SQLiteDatabase` instance. Migrations run on first open
 * using the async API (never block the JS thread).
 *
 * Skill rules followed:
 *  - `react-state-minimize`: the client is module-scoped — no React state.
 *  - null safety via `noUncheckedIndexedAccess` in tsconfig.
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME, type Migration, MIGRATIONS } from '@/db/schema';

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Open (or return the cached) database connection and run migrations. */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME, { enableChangeListener: false }).then((db) =>
      runMigrations(db).then(() => db),
    );
  }
  return dbPromise;
}

/** Reset the singleton — used by tests and the Settings "wipe data" action. */
export async function resetDatabaseHandle(): Promise<void> {
  dbPromise = null;
}

/** Run all pending migrations inside a transaction. */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Ensure the meta table exists before reading from it. We do this inline
  // rather than via a migration so subsequent migrations can rely on it.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS __meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM __meta WHERE key = 'schema_version';",
  );
  const currentVersion = row?.value ? Number(row.value) : 0;

  // Filter to migrations strictly newer than the current version.
  const pending: Migration[] = MIGRATIONS.filter((m) => m.version > currentVersion);

  if (pending.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const m of pending) {
      await db.execAsync(m.sql);
      await db.runAsync(
        "INSERT OR REPLACE INTO __meta (key, value) VALUES ('schema_version', ?);",
        String(m.version),
      );
    }
  });
}

/** For tests: get a fresh in-memory handle. Currently unused — placeholder so
 * we don't accidentally ship test-only wiring to production callers. */
export async function _withTestDatabase(_task: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  // Reserved for Step 12's query tests; we'll back this with expo-sqlite's
  // in-memory option if it lands upstream, otherwise a temporary file.
  throw new Error('not implemented');
}
