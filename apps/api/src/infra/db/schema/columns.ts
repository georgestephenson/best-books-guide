import { customType } from 'drizzle-orm/pg-core';
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
