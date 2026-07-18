import { pgTable, text, integer, numeric, uuid, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkId, createdAt, updatedAt } from './columns.js';
import { series } from './series.js';

/**
 * books (docs/03 §books). `slug` is the public address, generated from the title
 * (+ year on collision) and immutable after publish (app-enforced). `isbn13` and
 * `ol_work_key` are the import dedupe keys — nullable for manual entries, and a
 * plain `unique()` means "unique where not null" (Postgres NULLs are distinct).
 *
 * `rating_avg`/`rating_count` are denormalised aggregates recomputed in the same
 * transaction as any review write (docs/03 §aggregate maintenance) — they land in
 * M4; here they just carry their defaults. `series_id` is `SET NULL` so deleting a
 * series doesn't take its books with it.
 */
export const books = pgTable(
  'books',
  {
    id: pkId(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    isbn13: text('isbn13').unique(),
    olWorkKey: text('ol_work_key').unique(),
    // Relative path under the media dir, served at /covers/ by nginx (docs/02).
    coverPath: text('cover_path'),
    firstPublishedYear: integer('first_published_year'),
    pageCount: integer('page_count'),
    language: text('language').notNull().default('en'),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'set null' }),
    // numeric(4,1) allows novella positions like 2.5 (docs/03).
    seriesPosition: numeric('series_position', { precision: 4, scale: 1 }),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    ratingCount: integer('rating_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('books_title_trgm').using('gin', sql`${table.title} gin_trgm_ops`),
    // Series pages list books in reading order (docs/03 §indexes).
    index('books_series_idx').on(table.seriesId, table.seriesPosition),
  ],
);

export type BookRow = typeof books.$inferSelect;
export type NewBookRow = typeof books.$inferInsert;
