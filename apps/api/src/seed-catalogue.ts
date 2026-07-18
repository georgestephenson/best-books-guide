import { loadConfig } from './config.js';
import { createDb } from './infra/db/pool.js';
import { applySeed } from './seeds/apply-seed.js';
import { catalogueSeed } from './seeds/catalogue-data.js';

/**
 * Seed the catalogue with public-domain content (docs/03 §seeds, docs/07 §Runbooks):
 *
 *   npm -w apps/api run seed:catalogue          # local dev
 *   node dist/seed-catalogue.js                 # on the host (compiled, prod deps only)
 *
 * Idempotent — upserts by slug, so re-running converges rather than duplicating. Real
 * editorial content is added later through the admin UI, not here.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  try {
    await applySeed(db, catalogueSeed);
    // Bare console, not Pino: one-shot CLI, not the server.
    console.log(
      `seeded ${catalogueSeed.subjects.length} subjects, ${catalogueSeed.books.length} books, ${catalogueSeed.lists.length} lists`,
    );
  } finally {
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
