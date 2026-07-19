import type { ReadingStatus } from '@bestbooks/shared';
import type { BookSummaryRow } from './catalogue-repository.js';

/** The caller's shelf metadata for one book (dates as `YYYY-MM-DD`, DB-native). */
export interface ShelfEntry {
  status: ReadingStatus;
  startedOn: string | null;
  finishedOn: string | null;
  updatedAt: Date;
}

export interface ShelfBookRow extends ShelfEntry {
  book: BookSummaryRow;
}

/** My Books, grouped by shelf (docs/01 F3) — read model for the member's own books. */
export interface MyBooksRows {
  want_to_read: ShelfBookRow[];
  reading: ShelfBookRow[];
  finished: ShelfBookRow[];
}

export interface SetShelfInput {
  userId: string;
  bookId: string;
  status: ReadingStatus;
  startedOn: string | null;
  finishedOn: string | null;
}

/**
 * Reading-status ("shelves") write/read model (docs/03 §reading_statuses). Member
 * actions address books by public slug, so the repo resolves the id; a use-case that
 * gets `null` returns 404 without touching the DB again.
 */
export interface ReadingStatusRepository {
  findBookIdBySlug(slug: string): Promise<string | null>;
  /** Insert or replace the member's shelf for a book (upsert on the composite PK). */
  upsert(input: SetShelfInput): Promise<void>;
  remove(userId: string, bookId: string): Promise<void>;
  get(userId: string, bookId: string): Promise<ShelfEntry | null>;
  myBooks(userId: string): Promise<MyBooksRows>;
}
