import { pgTable, uuid, primaryKey, index } from 'drizzle-orm/pg-core';
import { books } from './books.js';
import { subjects } from './subjects.js';

/**
 * book_subjects (docs/03 §subjects) — a book may belong to several subjects (a list
 * belongs to one). Composite PK `(book_id, subject_id)`, both CASCADE. `subject_id`
 * gets its own index for the reverse lookup (subject book counts, `?subject=` filter).
 */
export const bookSubjects = pgTable(
  'book_subjects',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.subjectId] }),
    index('book_subjects_subject_idx').on(table.subjectId),
  ],
);

export type BookSubjectRow = typeof bookSubjects.$inferSelect;
export type NewBookSubjectRow = typeof bookSubjects.$inferInsert;
