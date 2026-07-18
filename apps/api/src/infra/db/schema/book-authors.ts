import { pgTable, uuid, integer, primaryKey, index } from 'drizzle-orm/pg-core';
import { books } from './books.js';
import { authors } from './authors.js';

/**
 * book_authors (docs/03 §authors) — a book's credited authors in order. Composite
 * PK `(book_id, author_id)`; `position` preserves credit order. Both FKs CASCADE:
 * deleting a book or author clears its credit rows. The `(book_id, …)` prefix of the
 * PK covers book→authors lookups; `author_id` gets its own index for the reverse
 * direction (same-author related strip, docs/03 §indexes).
 */
export const bookAuthors = pgTable(
  'book_authors',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.authorId] }),
    index('book_authors_author_idx').on(table.authorId),
  ],
);

export type BookAuthorRow = typeof bookAuthors.$inferSelect;
export type NewBookAuthorRow = typeof bookAuthors.$inferInsert;
