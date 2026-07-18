import { createDb } from '../src/infra/db/pool.js';
import { runMigrations } from '../src/infra/db/migrator.js';
import { TEST_DATABASE_URL } from './env.js';

/**
 * Runs once before the api-integration suite: migrate the test database. Every CI
 * run therefore doubles as a migration test (docs/02 §Testing strategy). Individual
 * tests reset row data with `resetStores()` rather than re-migrating.
 */
export default async function setup(): Promise<void> {
  const { db, pool } = createDb(TEST_DATABASE_URL);
  try {
    await runMigrations(db, pool);
  } catch (err) {
    throw new Error(
      `Integration-test setup failed to migrate ${TEST_DATABASE_URL}. ` +
        `Are the data stores up? Run \`docker compose up -d\`.\n${String(err)}`,
    );
  } finally {
    await pool.end();
  }
}
