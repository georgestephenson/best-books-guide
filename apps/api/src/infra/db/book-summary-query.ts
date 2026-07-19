import { asc, eq, inArray } from 'drizzle-orm';
import type { AuthorRef } from '@bestbooks/shared';
import type { BookSummaryRow } from '../../app/ports/catalogue-repository.js';
import type { Database } from './pool.js';
import { authors, bookAuthors, books } from './schema/index.js';

// numeric columns come back as strings from node-postgres; normalise at the edge.
const num = (v: string | null): number => (v === null ? 0 : Number(v));

/** Authors for a set of books, in credit order, keyed by book id. */
export async function authorsByBook(
  db: Database,
  bookIds: string[],
): Promise<Map<string, AuthorRef[]>> {
  const map = new Map<string, AuthorRef[]>();
  if (bookIds.length === 0) return map;
  const rows = await db
    .select({ bookId: bookAuthors.bookId, slug: authors.slug, name: authors.name })
    .from(bookAuthors)
    .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
    .where(inArray(bookAuthors.bookId, bookIds))
    .orderBy(asc(bookAuthors.position));
  for (const r of rows) {
    const list = map.get(r.bookId) ?? [];
    list.push({ slug: r.slug, name: r.name });
    map.set(r.bookId, list);
  }
  return map;
}

/**
 * Book summaries (with authors) for a set of ids, keyed by id — the shared read-model
 * assembly behind My Books and tracked-list rendering, matching the catalogue
 * repository's public book shape (docs/02 §clean-arch).
 */
export async function bookSummariesByIds(
  db: Database,
  bookIds: string[],
): Promise<Map<string, BookSummaryRow>> {
  const map = new Map<string, BookSummaryRow>();
  if (bookIds.length === 0) return map;
  const rows = await db.select().from(books).where(inArray(books.id, bookIds));
  const authorMap = await authorsByBook(db, bookIds);
  for (const b of rows) {
    map.set(b.id, {
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle,
      authors: authorMap.get(b.id) ?? [],
      coverPath: b.coverPath,
      firstPublishedYear: b.firstPublishedYear,
      ratingAvg: num(b.ratingAvg),
      ratingCount: b.ratingCount,
    });
  }
  return map;
}
