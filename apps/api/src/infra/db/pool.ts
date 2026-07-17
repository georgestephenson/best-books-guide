import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  pool: Pool;
}

/**
 * node-postgres, not postgres.js: it's drizzle's reference driver and shares its
 * migrator (`drizzle-orm/node-postgres/migrator`), which `migrate.ts` ships to prod.
 *
 * The caller owns the pool's lifecycle and must `pool.end()` on shutdown (see the
 * onClose hook in main.ts) — leaked connections keep the process alive past SIGTERM.
 */
export function createDb(databaseUrl: string): DbHandle {
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool, { schema }), pool };
}
