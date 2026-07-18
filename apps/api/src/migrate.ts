import { loadConfig } from './config.js';
import { createDb } from './infra/db/pool.js';
import { runMigrations } from './infra/db/migrator.js';

/**
 * Standalone migration runner — `node dist/migrate.js`, invoked by the deploy
 * playbook before the new release starts (docs/07 §Deploy mechanics). It ships in
 * the release tarball because it only needs `drizzle-orm` (a prod dependency);
 * `drizzle-kit` stays a devDependency used purely to *generate* migrations.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  try {
    await runMigrations(db, pool);
    // Bare console, not Pino: this runs as a one-shot CLI, not the server.
    console.log('migrations applied');
  } finally {
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
