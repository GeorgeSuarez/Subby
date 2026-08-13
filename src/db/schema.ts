/**
 * SQLite schema + versioned migrations.
 *
 * Migrations are append-only: never edit a shipped migration. Add a new one
 * with an incremented `version` and bump `LATEST_VERSION`.
 *
 * The runner in `db/client.ts` reads a `__meta` table to track which versions
 * have already been applied.
 */

/** SQLite row shape for the `subscriptions` table. Camel-cased domain objects
 * are produced in `db/queries.ts` from these rows. */
export interface SubscriptionRow {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cycle: string;
  next_renewal: string;
  category: string;
  icon: string;
  color: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
  archived: number; // 0/1
  seeded: number; // 0/1 — demo data rows are invisible to non-test accounts
  trial_ends: string | null; // ISO date — free-trial end (optional)
  notification_id: string | null; // scheduled renewal reminder id (optional)
}

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

/**
 * Migration list — append new ones at the bottom.
 * Schema rationale:
 *  - `id` TEXT PRIMARY KEY — we use UUIDs generated in JS, not rowid, so the
 *    id is stable across exports/imports.
 *  - `amount` REAL — major currency units (e.g. 9.99). Per-row currency is
 *    stored alongside so multi-currency is fully supported.
 *  - `next_renewal` TEXT ISO date (YYYY-MM-DD).
 *  - `archived` INTEGER 0/1 — SQLite has no native bool.
 *  - Timestamps are epoch ms (INTEGER), sortable and TZ-free.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'create subscriptions table',
    sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id            TEXT    PRIMARY KEY NOT NULL,
        name          TEXT    NOT NULL,
        amount        REAL    NOT NULL,
        currency      TEXT    NOT NULL,
        cycle         TEXT    NOT NULL,
        next_renewal  TEXT    NOT NULL,
        category      TEXT    NOT NULL,
        icon          TEXT    NOT NULL,
        color         TEXT,
        notes         TEXT,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        archived      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_archived ON subscriptions (archived);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_next_renewal ON subscriptions (next_renewal);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON subscriptions (category);
    `,
  },
  {
    version: 2,
    description: 'create meta table for migration tracking',
    sql: `
      CREATE TABLE IF NOT EXISTS __meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    description: 'add seeded flag for demo data rows',
    // Marks rows created by the demo-data seed so reads can filter them out
    // for every account except the test account. The name-based UPDATE is a
    // one-time backfill for devices that auto-seeded before v3 existed — new
    // seed loads set the flag at insert time.
    sql: `
      ALTER TABLE subscriptions ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;
      UPDATE subscriptions SET seeded = 1
        WHERE name IN ('Netflix', 'Spotify', 'iCloud+', 'GitHub', 'Figma', 'Disney+', 'New York Times');
    `,
  },
  {
    version: 4,
    description: 'add trial tracking and renewal-reminder columns',
    sql: `
      ALTER TABLE subscriptions ADD COLUMN trial_ends TEXT;
      ALTER TABLE subscriptions ADD COLUMN notification_id TEXT;
    `,
  },
  {
    version: 5,
    description: 'create notification sidecar for Supabase-backed subscriptions',
    // Subscriptions moved to Supabase; renewal-reminder notification ids are
    // device-local bookkeeping (meaningless server-side), so they live in
    // this map keyed by subscription id. The legacy `subscriptions` table
    // stays for backwards-compatible migration history only.
    sql: `
      CREATE TABLE IF NOT EXISTS notification_map (
        subscription_id TEXT PRIMARY KEY NOT NULL,
        notification_id TEXT NOT NULL
      );
    `,
  },
  {
    version: 6,
    description: 'create offline sync cache and write queue',
    // Offline support: `sync_cache` holds the last-synced per-user snapshots
    // (subscriptions + prefs JSON, keyed `subs:<user_id>` / `prefs:<user_id>`)
    // so reads work without connectivity. `sync_queue` is the FIFO write
    // queue of operations made while offline; ops carry the owning user id so
    // the queue survives account switches and only flushes for its owner.
    sql: `
      CREATE TABLE IF NOT EXISTS sync_cache (
        key        TEXT PRIMARY KEY NOT NULL,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_queue (
        op_id      TEXT PRIMARY KEY NOT NULL,
        user_id    TEXT NOT NULL,
        type       TEXT NOT NULL,
        payload    TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue (user_id, created_at);
    `,
  },
] as const;

/** Highest migration version in the list. Bump when you append a migration. */
export const LATEST_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** The SQLite database filename (under the app's default database directory). */
export const DATABASE_NAME = 'subby.db';