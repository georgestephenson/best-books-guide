import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkId, createdAt, updatedAt } from './columns.js';

/**
 * authors (docs/03 §authors). `ol_author_key` is the Open Library dedupe key for
 * imports — nullable for manual entries, and `unique()` gives "unique where not
 * null" for free (Postgres treats NULLs as distinct in a unique index).
 *
 * The GIN trigram index on `name` powers MVP author search (`ILIKE '%q%'`) and the
 * same-author related strip (docs/03 §indexes); `pg_trgm` is enabled in 0000.
 */
export const authors = pgTable(
  'authors',
  {
    id: pkId(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    olAuthorKey: text('ol_author_key').unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('authors_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`)],
);

export type AuthorRow = typeof authors.$inferSelect;
export type NewAuthorRow = typeof authors.$inferInsert;
