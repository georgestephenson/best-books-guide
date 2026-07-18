import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { createDb, type DbHandle } from '../src/infra/db/pool.js';
import { createRedis } from '../src/infra/redis/client.js';
import { buildServer } from '../src/http/server.js';
import { composeServerDeps } from '../src/composition.js';
import { loadConfig } from '../src/config.js';
import type { EmailMessage, EmailSender } from '../src/app/ports/email-sender.js';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './env.js';

/** Captures sent email so tests can read back verification/reset tokens. */
export class CapturingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

/** Pull the `token` query param out of an emailed link. */
export function tokenFromEmail(message: EmailMessage): string {
  const match = message.text.match(/[?&]token=([^\s&]+)/);
  if (!match) throw new Error(`no token link in email: ${message.subject}`);
  return decodeURIComponent(match[1]!);
}

// One connection per test file (vitest isolates module state per file); each file
// closes them in afterAll via closeStores().
let handle: DbHandle | undefined;
let redisClient: Redis | undefined;

export function testDb(): DbHandle {
  handle ??= createDb(TEST_DATABASE_URL);
  return handle;
}

export function testRedis(): Redis {
  redisClient ??= createRedis(TEST_REDIS_URL);
  return redisClient;
}

/** Wipe row data between tests without re-running migrations. */
export async function resetStores(): Promise<void> {
  const { pool } = testDb();
  // The drizzle bookkeeping table lives in the `drizzle` schema, so truncating all
  // of `public` leaves migration history intact.
  const { rows } = await pool.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.tablename}"`).join(', ');
    await pool.query(`truncate table ${list} restart identity cascade`);
  }
  await testRedis().flushdb();
}

export async function closeStores(): Promise<void> {
  if (handle) await handle.pool.end();
  if (redisClient) await redisClient.quit();
  handle = undefined;
  redisClient = undefined;
}

export interface TestServer {
  app: FastifyInstance;
  /** Emails "sent" during the test, newest last. */
  emails: EmailMessage[];
}

/** A full Fastify app wired to the real test stores, for `.inject()` integration tests. */
export function buildTestServer(): TestServer {
  const { db, pool } = testDb();
  const redis = testRedis();
  const config = loadConfig({ NODE_ENV: 'test', APP_VERSION: 'test' });
  const emailSender = new CapturingEmailSender();
  const app = buildServer(composeServerDeps({ config, db, pool, redis, emailSender }));
  return { app, emails: emailSender.sent };
}
