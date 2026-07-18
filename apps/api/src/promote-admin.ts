import { loadConfig } from './config.js';
import { createDb } from './infra/db/pool.js';
import { DrizzleUserRepository } from './infra/db/drizzle-user-repository.js';

/**
 * Admin bootstrap runbook (docs/03, docs/07 §Runbooks). There is no admin signup
 * path — the first editor is promoted here, out of band:
 *
 *   npm -w apps/api run promote-admin -- <email>
 *
 * on the host it's `node dist/promote-admin.js <email>` against the live DATABASE_URL.
 * Idempotent: promoting an existing admin is a no-op that still reports success.
 */
async function main(): Promise<void> {
  const email = process.argv[2]?.trim();
  if (!email) {
    // Bare console, not Pino: this is a one-shot CLI, not the server.
    console.error('usage: promote-admin -- <email>');
    process.exit(2);
  }

  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  try {
    const users = new DrizzleUserRepository(db);
    const user = await users.promoteToAdmin(email);
    if (!user) {
      console.error(`no user found with email ${email}`);
      process.exit(1);
    }
    console.log(`promoted ${user.email} (${user.id}) to admin`);
  } finally {
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
