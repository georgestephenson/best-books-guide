import { pgTable, uuid, integer, text, unique, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkId } from './columns.js';
import { lists } from './lists.js';
import { books } from './books.js';
import { series } from './series.js';

/**
 * list_items (docs/03 §lists) — a ranked slot in a list, holding a book **or** a
 * series (`num_nonnulls(book_id, series_id) = 1`). Content FKs RESTRICT: remove an
 * item from its lists before deleting the book/series from the catalogue.
 *
 * The `(list_id, book_id)` / `(list_id, series_id)` uniques prevent listing the same
 * thing twice while still allowing many series-items (book_id NULL) or many
 * book-items (series_id NULL) per list — Postgres NULLs are distinct in a unique
 * index, so these behave as "unique where the FK is set".
 *
 * `UNIQUE (list_id, rank) DEFERRABLE INITIALLY DEFERRED` is added by hand in the
 * migration — drizzle-kit can't emit DEFERRABLE — so a whole-list reorder can swap
 * ranks within one transaction (docs/03, ADR-0010). It also serves as the
 * `(list_id, rank)` render-order index, so no separate index is declared here.
 */
export const listItems = pgTable(
  'list_items',
  {
    id: pkId(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').references(() => books.id, { onDelete: 'restrict' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'restrict' }),
    rank: integer('rank').notNull(),
    blurb: text('blurb'),
  },
  (table) => [
    unique('list_items_book_unique').on(table.listId, table.bookId),
    unique('list_items_series_unique').on(table.listId, table.seriesId),
    check('list_items_one_target', sql`num_nonnulls(${table.bookId}, ${table.seriesId}) = 1`),
    // Reverse lookups: which lists a book/series appears on, RESTRICT FK checks.
    index('list_items_book_idx').on(table.bookId),
    index('list_items_series_idx').on(table.seriesId),
  ],
);

export type ListItemRow = typeof listItems.$inferSelect;
export type NewListItemRow = typeof listItems.$inferInsert;
