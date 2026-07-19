import { pgTable, uuid, smallint, text, boolean, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkId, createdAt, updatedAt } from './columns.js';
import { users } from './users.js';
import { books } from './books.js';

/**
 * reviews (docs/03 §reviews) — a required 1–5 rating plus optional text (F4/F5), one
 * per member per book (`UNIQUE (user_id, book_id)` is the upsert conflict target).
 * `body IS NULL` is a bare star rating; a non-null body is a written review. Moderators
 * soft-hide via `is_hidden`/`hidden_reason`; public queries filter `is_hidden = false`
 * while the author still sees their own hidden review flagged. Both FKs CASCADE.
 *
 * The partial index `(book_id, created_at desc) WHERE NOT is_hidden` backs the book
 * page's public review listing (docs/03 §indexes). Rating aggregates on `books` are
 * recomputed in the same transaction as any write here — see the review repository.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: pkId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    body: text('body'),
    isHidden: boolean('is_hidden').notNull().default(false),
    hiddenReason: text('hidden_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('reviews_user_book_unique').on(table.userId, table.bookId),
    check('reviews_rating_check', sql`${table.rating} between 1 and 5`),
    index('reviews_book_visible_idx')
      .on(table.bookId, table.createdAt.desc())
      .where(sql`not ${table.isHidden}`),
  ],
);

export type ReviewRow = typeof reviews.$inferSelect;
export type NewReviewRow = typeof reviews.$inferInsert;
