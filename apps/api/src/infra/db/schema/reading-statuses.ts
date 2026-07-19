import { pgTable, uuid, text, date, timestamp, primaryKey, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { books } from './books.js';

/**
 * reading_statuses (docs/03 §reading_statuses) — one shelf per member per book (F3).
 * Composite PK `(user_id, book_id)` gives the upsert its conflict target. Both FKs
 * CASCADE: deleting a user or book takes their shelves with it. `finished_on` is
 * constrained to only be set on the `finished` shelf; `started_on` is free-form.
 *
 * The `(user_id, status, updated_at desc)` index backs the grouped My Books query
 * (docs/03 §indexes) — the finished shelf, newest first, is the reading log.
 */
export const readingStatuses = pgTable(
  'reading_statuses',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    startedOn: date('started_on'),
    finishedOn: date('finished_on'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.bookId] }),
    check('reading_statuses_status_check', sql`${table.status} in ('want_to_read', 'reading', 'finished')`),
    // finished_on only makes sense on the finished shelf (docs/03).
    check(
      'reading_statuses_finished_on_check',
      sql`${table.finishedOn} is null or ${table.status} = 'finished'`,
    ),
    index('reading_statuses_shelf_idx').on(table.userId, table.status, table.updatedAt.desc()),
  ],
);

export type ReadingStatusRow = typeof readingStatuses.$inferSelect;
export type NewReadingStatusRow = typeof readingStatuses.$inferInsert;
