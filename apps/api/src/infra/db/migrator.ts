import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './pool.js';

// dist mirrors src, so ../../../drizzle resolves to apps/api/drizzle from both the
// compiled dist/infra/db/migrator.js and the TS source under test.
const MIGRATIONS_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../drizzle');

// Serialises concurrent migrate runs (docs/03, docs/07): a fixed session-level
// advisory-lock key so two overlapping deploys can't apply migrations at once.
// drizzle-kit has no such flag, so we wrap the call ourselves.
const MIGRATION_LOCK_KEY = 4927302;

/**
 * Apply pending migrations under a PostgreSQL advisory lock. The lock is held on a
 * dedicated connection for the duration — it blocks *other* deploys' migrate runs,
 * not our own DDL, which proceeds on pool connections.
 */
export async function runMigrations(db: Database, pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    client.release();
  }
}
