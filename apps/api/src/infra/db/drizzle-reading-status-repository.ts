import { and, eq, desc } from 'drizzle-orm';
import type { ReadingStatus } from '@bestbooks/shared';
import type {
  MyBooksRows,
  ReadingStatusRepository,
  SetShelfInput,
  ShelfBookRow,
  ShelfEntry,
} from '../../app/ports/reading-status-repository.js';
import type { Database } from './pool.js';
import { books, readingStatuses } from './schema/index.js';
import { bookSummariesByIds } from './book-summary-query.js';

export class DrizzleReadingStatusRepository implements ReadingStatusRepository {
  constructor(private readonly db: Database) {}

  async findBookIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.db.select({ id: books.id }).from(books).where(eq(books.slug, slug)).limit(1);
    return row?.id ?? null;
  }

  async upsert(input: SetShelfInput): Promise<void> {
    await this.db
      .insert(readingStatuses)
      .values({
        userId: input.userId,
        bookId: input.bookId,
        status: input.status,
        startedOn: input.startedOn,
        finishedOn: input.finishedOn,
      })
      .onConflictDoUpdate({
        target: [readingStatuses.userId, readingStatuses.bookId],
        set: { status: input.status, startedOn: input.startedOn, finishedOn: input.finishedOn },
      });
  }

  async remove(userId: string, bookId: string): Promise<void> {
    await this.db
      .delete(readingStatuses)
      .where(and(eq(readingStatuses.userId, userId), eq(readingStatuses.bookId, bookId)));
  }

  async get(userId: string, bookId: string): Promise<ShelfEntry | null> {
    const [row] = await this.db
      .select({
        status: readingStatuses.status,
        startedOn: readingStatuses.startedOn,
        finishedOn: readingStatuses.finishedOn,
        updatedAt: readingStatuses.updatedAt,
      })
      .from(readingStatuses)
      .where(and(eq(readingStatuses.userId, userId), eq(readingStatuses.bookId, bookId)))
      .limit(1);
    if (!row) return null;
    return {
      status: row.status as ReadingStatus,
      startedOn: row.startedOn,
      finishedOn: row.finishedOn,
      updatedAt: row.updatedAt,
    };
  }

  async myBooks(userId: string): Promise<MyBooksRows> {
    const rows = await this.db
      .select({
        bookId: readingStatuses.bookId,
        status: readingStatuses.status,
        startedOn: readingStatuses.startedOn,
        finishedOn: readingStatuses.finishedOn,
        updatedAt: readingStatuses.updatedAt,
      })
      .from(readingStatuses)
      .where(eq(readingStatuses.userId, userId))
      .orderBy(desc(readingStatuses.updatedAt));

    const bookMap = await bookSummariesByIds(
      this.db,
      rows.map((r) => r.bookId),
    );

    const grouped: MyBooksRows = { want_to_read: [], reading: [], finished: [] };
    for (const r of rows) {
      const book = bookMap.get(r.bookId);
      if (!book) continue; // book deleted mid-flight — skip rather than emit a partial row
      const entry: ShelfBookRow = {
        status: r.status as ReadingStatus,
        startedOn: r.startedOn,
        finishedOn: r.finishedOn,
        updatedAt: r.updatedAt,
        book,
      };
      grouped[entry.status].push(entry);
    }
    return grouped;
  }
}
