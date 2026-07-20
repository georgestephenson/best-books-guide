import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

/**
 * `citext` — case-insensitive text, used for email so uniqueness and lookups fold
 * case in the database rather than in every query (docs/03 §conventions). Drizzle
 * has no built-in for it; the extension is enabled in migration 0001.
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

/**
 * PostgreSQL 18's native, time-ordered UUID default. Drizzle's `uuid().defaultRandom()`
 * emits `gen_random_uuid()` (v4, index-unfriendly) — we want v7 (docs/03 §conventions),
 * so the default is spelled out.
 */
export function uuidv7Default(): SQL {
  return sql`uuidv7()`;
}

/**
 * Shared column shapes for the catalogue tables (docs/03 §conventions), spelled out
 * once so the tables don't each re-declare the same PK/timestamp boilerplate.
 * `users` (migration 0000) predates these and stays inlined — no churn for churn's sake.
 */
export const pkId = () => uuid('id').primaryKey().default(uuidv7Default());
export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    // App-maintained on every update (docs/03) — no trigger, same as users.
    .$onUpdate(() => sql`now()`);
