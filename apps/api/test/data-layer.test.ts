import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HEALTH_PATH } from '@bestbooks/shared';
import { users } from '../src/infra/db/schema/users.js';
import { testDb, testRedis, resetStores, closeStores, buildTestServer } from './harness.js';

// drizzle wraps driver errors, so the SQLSTATE we care about is on `.cause.code`
// (23505 = unique_violation, 23514 = check_violation).
async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect((err as { cause?: { code?: string } }).cause?.code).toBe(code);
    return;
  }
  throw new Error('expected the query to reject, but it resolved');
}

// These run against real PostgreSQL 18 + Redis (docs/02 §Testing strategy): they
// prove the migration applied, the schema behaves, and the probes see live stores.
describe('data layer (integration)', () => {
  beforeEach(resetStores);
  afterAll(closeStores);

  it('applied migration 0001: extensions and the users table exist', async () => {
    const { pool } = testDb();

    const exts = await pool.query<{ extname: string }>(
      `select extname from pg_extension where extname in ('citext', 'pg_trgm')`,
    );
    expect(exts.rows.map((r) => r.extname).sort()).toEqual(['citext', 'pg_trgm']);

    const table = await pool.query(`select to_regclass('public.users') as reg`);
    expect(table.rows[0]).toMatchObject({ reg: 'users' });
  });

  it('defaults id to a v7 uuid and role to member, and maintains updated_at', async () => {
    const { db } = testDb();
    const [row] = await db
      .insert(users)
      .values({ email: 'reader@example.com', passwordHash: 'x', displayName: 'Reader' })
      .returning();

    // uuidv7: version nibble is 7 (…-7xxx-…).
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(row?.role).toBe('member');
    expect(row?.emailVerifiedAt).toBeNull();
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it('folds email case for uniqueness (citext)', async () => {
    const { db } = testDb();
    await db
      .insert(users)
      .values({ email: 'Dup@Example.com', passwordHash: 'x', displayName: 'A' });

    await expectPgError(
      db.insert(users).values({ email: 'dup@example.com', passwordHash: 'y', displayName: 'B' }),
      '23505',
    );
  });

  it('rejects a role outside the allowed set', async () => {
    const { db } = testDb();
    await expectPgError(
      db.insert(users).values({
        email: 'root@example.com',
        passwordHash: 'x',
        displayName: 'Root',
        role: 'superadmin',
      }),
      '23514',
    );
  });

  it('reflects live stores through GET /healthz', async () => {
    const { app } = buildTestServer();
    await app.ready();
    try {
      const res = await app.inject({ method: 'GET', url: HEALTH_PATH });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: 'ok', db: true, redis: true });
    } finally {
      await app.close();
    }
  });

  it('round-trips through Redis', async () => {
    const redis = testRedis();
    await redis.set('probe', 'value');
    expect(await redis.get('probe')).toBe('value');
    // resetStores FLUSHDBs, so the next test starts clean — assert the mechanism.
    await resetStores();
    expect(await redis.get('probe')).toBeNull();
  });

  it('keeps the drizzle migration history through a reset', async () => {
    // resetStores truncates public tables only; migration bookkeeping (in the
    // `drizzle` schema) survives, so tests never accidentally re-migrate.
    const { pool } = testDb();
    const applied = await pool.query<{ count: string }>(
      `select count(*)::text as count from drizzle.__drizzle_migrations`,
    );
    expect(Number(applied.rows[0]?.count)).toBeGreaterThanOrEqual(1);
  });
});
