import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { createDb, type DbHandle } from '../src/infra/db/pool.js';
import { createRedis } from '../src/infra/redis/client.js';
import { PgHealthProbe } from '../src/infra/db/pg-health-probe.js';
import { RedisHealthProbe } from '../src/infra/redis/redis-health-probe.js';
import { SystemClock } from '../src/infra/clock.js';
import { GetHealth } from '../src/app/usecases/get-health.js';
import { buildServer } from '../src/http/server.js';
import { loadConfig } from '../src/config.js';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './env.js';

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

/** A Fastify app wired to the real test stores, for `.inject()` integration tests. */
export function buildTestServer(): FastifyInstance {
  const { pool } = testDb();
  const redis = testRedis();
  const config = loadConfig({ NODE_ENV: 'test', APP_VERSION: 'test' });
  const getHealth = new GetHealth({
    clock: new SystemClock(),
    version: 'test',
    db: new PgHealthProbe(pool),
    redis: new RedisHealthProbe(redis),
  });
  return buildServer({ config, getHealth });
}
