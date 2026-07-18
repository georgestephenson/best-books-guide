import { and, asc, eq, exists, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AuthorRef, SubjectRef } from '@bestbooks/shared';
import type {
  BookDetailRow,
  BookSearchParams,
  BookSearchResult,
  BookSummaryRow,
  CatalogueRepository,
  ListItemRow,
  ListReadModel,
  ListSummaryRow,
  RelatedBookRow,
  SeriesDetailRow,
  SitemapSlugs,
  SubjectWithLists,
} from '../../app/ports/catalogue-repository.js';
import type { Database } from './pool.js';
import {
  authors,
  bookAuthors,
  bookSubjects,
  books,
  listItems,
  lists,
  series,
  subjects,
} from './schema/index.js';

const RELATED_LIMIT = 6;

// A keyset cursor over (title, id) — opaque base64url to the client, stable under
// inserts (docs/04 §pagination).
function encodeCursor(title: string, id: string): string {
  return Buffer.from(JSON.stringify([title, id]), 'utf8').toString('base64url');
}
function decodeCursor(cursor: string): { title: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      return { title: parsed[0], id: parsed[1] };
    }
  } catch {
    /* malformed cursor → treated as no cursor */
  }
  return null;
}

// numeric columns come back as strings from node-postgres; normalise at the edge.
const num = (v: string | null): number => (v === null ? 0 : Number(v));
const numOrNull = (v: string | null): number | null => (v === null ? null : Number(v));

export class DrizzleCatalogueRepository implements CatalogueRepository {
  constructor(private readonly db: Database) {}

  /** Authors for a set of books, in credit order, as a Map keyed by book id. */
  private async authorsByBook(bookIds: string[]): Promise<Map<string, AuthorRef[]>> {
    const map = new Map<string, AuthorRef[]>();
    if (bookIds.length === 0) return map;
    const rows = await this.db
      .select({
        bookId: bookAuthors.bookId,
        slug: authors.slug,
        name: authors.name,
      })
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

  /** Published top-level lists (with direct-item counts), optionally one subject. */
  private async publishedTopLevelLists(
    subjectId?: string,
  ): Promise<Map<string, ListSummaryRow[]>> {
    const rows = await this.db
      .select({
        subjectId: lists.subjectId,
        slug: lists.slug,
        title: lists.title,
        intro: lists.intro,
        itemCount: sql<number>`count(${listItems.id})::int`,
      })
      .from(lists)
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .where(
        and(
          eq(lists.isPublished, true),
          isNull(lists.parentListId),
          subjectId ? eq(lists.subjectId, subjectId) : undefined,
        ),
      )
      .groupBy(lists.id)
      .orderBy(asc(lists.title));

    const bySubject = new Map<string, ListSummaryRow[]>();
    for (const r of rows) {
      const list = bySubject.get(r.subjectId) ?? [];
      list.push({ slug: r.slug, title: r.title, intro: r.intro, itemCount: r.itemCount });
      bySubject.set(r.subjectId, list);
    }
    return bySubject;
  }

  async listPublishedSubjects(): Promise<SubjectWithLists[]> {
    const subjectRows = await this.db
      .select()
      .from(subjects)
      .orderBy(asc(subjects.position), asc(subjects.name));
    const listsBySubject = await this.publishedTopLevelLists();

    // Only surface subjects that actually have something published to read.
    return subjectRows
      .filter((s) => (listsBySubject.get(s.id)?.length ?? 0) > 0)
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        lists: listsBySubject.get(s.id) ?? [],
      }));
  }

  async findSubjectBySlug(slug: string): Promise<SubjectWithLists | null> {
    const [row] = await this.db.select().from(subjects).where(eq(subjects.slug, slug)).limit(1);
    if (!row) return null;
    const listsBySubject = await this.publishedTopLevelLists(row.id);
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      lists: listsBySubject.get(row.id) ?? [],
    };
  }

  async findPublishedListBySlug(slug: string): Promise<ListReadModel | null> {
    const [row] = await this.db
      .select({
        id: lists.id,
        slug: lists.slug,
        title: lists.title,
        intro: lists.intro,
        isPublished: lists.isPublished,
        parentListId: lists.parentListId,
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
      })
      .from(lists)
      .innerJoin(subjects, eq(subjects.id, lists.subjectId))
      .where(eq(lists.slug, slug))
      .limit(1);
    if (!row || !row.isPublished) return null;

    // Sublist visibility: public only when the parent is also published (docs/03).
    let parent: { slug: string; title: string } | null = null;
    if (row.parentListId) {
      const [p] = await this.db
        .select({ slug: lists.slug, title: lists.title, isPublished: lists.isPublished })
        .from(lists)
        .where(eq(lists.id, row.parentListId))
        .limit(1);
      if (!p || !p.isPublished) return null;
      parent = { slug: p.slug, title: p.title };
    }

    const items = await this.listItemsFor(row.id);

    // A parent list maps its published sublists; a sublist has none.
    const sublistRows = await this.db
      .select({
        slug: lists.slug,
        title: lists.title,
        intro: lists.intro,
        itemCount: sql<number>`count(${listItems.id})::int`,
      })
      .from(lists)
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .where(and(eq(lists.parentListId, row.id), eq(lists.isPublished, true)))
      .groupBy(lists.id)
      .orderBy(asc(lists.title));

    return {
      slug: row.slug,
      title: row.title,
      intro: row.intro,
      subject: { slug: row.subjectSlug, name: row.subjectName },
      parent,
      items,
      sublists: sublistRows,
    };
  }

  private async listItemsFor(listId: string): Promise<ListItemRow[]> {
    const rows = await this.db
      .select({
        rank: listItems.rank,
        blurb: listItems.blurb,
        bookId: listItems.bookId,
        seriesId: listItems.seriesId,
      })
      .from(listItems)
      .where(eq(listItems.listId, listId))
      .orderBy(asc(listItems.rank));
    if (rows.length === 0) return [];

    const bookIds = rows.flatMap((r) => (r.bookId ? [r.bookId] : []));
    const seriesIds = rows.flatMap((r) => (r.seriesId ? [r.seriesId] : []));
    const bookMap = await this.bookSummariesById(bookIds);
    const seriesMap = await this.seriesSummariesById(seriesIds);

    const items: ListItemRow[] = [];
    for (const r of rows) {
      if (r.bookId) {
        const book = bookMap.get(r.bookId);
        if (book) items.push({ type: 'book', rank: r.rank, blurb: r.blurb, book });
      } else if (r.seriesId) {
        const s = seriesMap.get(r.seriesId);
        if (s) items.push({ type: 'series', rank: r.rank, blurb: r.blurb, series: s });
      }
    }
    return items;
  }

  private async bookSummariesById(bookIds: string[]): Promise<Map<string, BookSummaryRow>> {
    const map = new Map<string, BookSummaryRow>();
    if (bookIds.length === 0) return map;
    const rows = await this.db.select().from(books).where(inArray(books.id, bookIds));
    const authorMap = await this.authorsByBook(bookIds);
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

  private async seriesSummariesById(
    seriesIds: string[],
  ): Promise<Map<string, { slug: string; title: string; description: string | null; bookCount: number }>> {
    const map = new Map<
      string,
      { slug: string; title: string; description: string | null; bookCount: number }
    >();
    if (seriesIds.length === 0) return map;
    const rows = await this.db
      .select({
        id: series.id,
        slug: series.slug,
        title: series.title,
        description: series.description,
        bookCount: sql<number>`count(${books.id})::int`,
      })
      .from(series)
      .leftJoin(books, eq(books.seriesId, series.id))
      .where(inArray(series.id, seriesIds))
      .groupBy(series.id);
    for (const s of rows) {
      map.set(s.id, { slug: s.slug, title: s.title, description: s.description, bookCount: s.bookCount });
    }
    return map;
  }

  async searchBooks(params: BookSearchParams): Promise<BookSearchResult> {
    const { search, subjectSlug, limit } = params;
    const cursor = params.cursor ? decodeCursor(params.cursor) : null;

    const conditions = [];
    if (search) {
      const like = `%${search}%`;
      conditions.push(
        or(
          ilike(books.title, like),
          exists(
            this.db
              .select({ one: sql`1` })
              .from(bookAuthors)
              .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
              .where(and(eq(bookAuthors.bookId, books.id), ilike(authors.name, like))),
          ),
        ),
      );
    }
    if (subjectSlug) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(bookSubjects)
            .innerJoin(subjects, eq(subjects.id, bookSubjects.subjectId))
            .where(and(eq(bookSubjects.bookId, books.id), eq(subjects.slug, subjectSlug))),
        ),
      );
    }
    // Keyset: everything ordered after the cursor's (title, id).
    if (cursor) {
      conditions.push(sql`(${books.title}, ${books.id}) > (${cursor.title}, ${cursor.id})`);
    }

    const rows = await this.db
      .select()
      .from(books)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(books.title), asc(books.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const authorMap = await this.authorsByBook(page.map((b) => b.id));
    const items: BookSummaryRow[] = page.map((b) => ({
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle,
      authors: authorMap.get(b.id) ?? [],
      coverPath: b.coverPath,
      firstPublishedYear: b.firstPublishedYear,
      ratingAvg: num(b.ratingAvg),
      ratingCount: b.ratingCount,
    }));
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last ? encodeCursor(last.title, last.id) : null;
    return { items, nextCursor };
  }

  async findBookBySlug(slug: string): Promise<BookDetailRow | null> {
    const [b] = await this.db.select().from(books).where(eq(books.slug, slug)).limit(1);
    if (!b) return null;

    const authorMap = await this.authorsByBook([b.id]);
    const bookAuthorRefs = authorMap.get(b.id) ?? [];

    const subjectRefs: SubjectRef[] = await this.db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(bookSubjects)
      .innerJoin(subjects, eq(subjects.id, bookSubjects.subjectId))
      .where(eq(bookSubjects.bookId, b.id))
      .orderBy(asc(subjects.name));

    let seriesRef: { slug: string; title: string; position: number | null } | null = null;
    if (b.seriesId) {
      const [s] = await this.db
        .select({ slug: series.slug, title: series.title })
        .from(series)
        .where(eq(series.id, b.seriesId))
        .limit(1);
      if (s) seriesRef = { slug: s.slug, title: s.title, position: numOrNull(b.seriesPosition) };
    }

    // Appearances on publicly-visible lists only.
    const listAppearances = await this.db
      .select({ listSlug: lists.slug, listTitle: lists.title, rank: listItems.rank })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(and(eq(listItems.bookId, b.id), this.listIsPublic()))
      .orderBy(asc(lists.title));

    const related = await this.relatedBooks(b.id, bookAuthorRefs);

    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle,
      authors: bookAuthorRefs,
      description: b.description,
      coverPath: b.coverPath,
      firstPublishedYear: b.firstPublishedYear,
      pageCount: b.pageCount,
      language: b.language,
      subjects: subjectRefs,
      series: seriesRef,
      listAppearances,
      related,
      ratingAvg: num(b.ratingAvg),
      ratingCount: b.ratingCount,
    };
  }

  // A list is public iff it's published and (top-level or its parent is published).
  private listIsPublic() {
    const parent = alias(lists, 'parent');
    return and(
      eq(lists.isPublished, true),
      or(
        isNull(lists.parentListId),
        exists(
          this.db
            .select({ one: sql`1` })
            .from(parent)
            .where(and(eq(parent.id, lists.parentListId), eq(parent.isPublished, true))),
        ),
      ),
    );
  }

  /** Same-author first, then co-listed, deduped and capped (docs/01 F1 related strip). */
  private async relatedBooks(bookId: string, bookAuthors_: AuthorRef[]): Promise<RelatedBookRow[]> {
    const out: RelatedBookRow[] = [];
    const seen = new Set<string>();

    if (bookAuthors_.length > 0) {
      const sameAuthor = await this.db
        .selectDistinct({ slug: books.slug, title: books.title, coverPath: books.coverPath })
        .from(books)
        .innerJoin(bookAuthors, eq(bookAuthors.bookId, books.id))
        .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
        .where(
          and(
            inArray(
              authors.slug,
              bookAuthors_.map((a) => a.slug),
            ),
            sql`${books.id} <> ${bookId}`,
          ),
        )
        .limit(RELATED_LIMIT);
      for (const r of sameAuthor) {
        if (seen.has(r.slug)) continue;
        seen.add(r.slug);
        out.push({ slug: r.slug, title: r.title, coverPath: r.coverPath, reason: 'same-author' });
      }
    }

    if (out.length < RELATED_LIMIT) {
      // Books sharing a list with this one (co-listed), on public lists.
      const selfLi = alias(listItems, 'self_li');
      const coListed = await this.db
        .selectDistinct({ slug: books.slug, title: books.title, coverPath: books.coverPath })
        .from(listItems)
        .innerJoin(lists, eq(lists.id, listItems.listId))
        .innerJoin(books, eq(books.id, listItems.bookId))
        .where(
          and(
            this.listIsPublic(),
            sql`${books.id} <> ${bookId}`,
            exists(
              this.db
                .select({ one: sql`1` })
                .from(selfLi)
                .where(and(eq(selfLi.listId, listItems.listId), eq(selfLi.bookId, bookId))),
            ),
          ),
        )
        .limit(RELATED_LIMIT);
      for (const r of coListed) {
        if (out.length >= RELATED_LIMIT) break;
        if (seen.has(r.slug)) continue;
        seen.add(r.slug);
        out.push({ slug: r.slug, title: r.title, coverPath: r.coverPath, reason: 'co-listed' });
      }
    }

    return out;
  }

  async findSeriesBySlug(slug: string): Promise<SeriesDetailRow | null> {
    const [s] = await this.db.select().from(series).where(eq(series.slug, slug)).limit(1);
    if (!s) return null;

    const bookRows = await this.db
      .select()
      .from(books)
      .where(eq(books.seriesId, s.id))
      .orderBy(sql`${books.seriesPosition} asc nulls last`, asc(books.title));
    const authorMap = await this.authorsByBook(bookRows.map((b) => b.id));

    return {
      slug: s.slug,
      title: s.title,
      description: s.description,
      books: bookRows.map((b) => ({
        slug: b.slug,
        title: b.title,
        subtitle: b.subtitle,
        authors: authorMap.get(b.id) ?? [],
        coverPath: b.coverPath,
        firstPublishedYear: b.firstPublishedYear,
        ratingAvg: num(b.ratingAvg),
        ratingCount: b.ratingCount,
        seriesPosition: numOrNull(b.seriesPosition),
      })),
    };
  }

  async sitemapSlugs(): Promise<SitemapSlugs> {
    const [subjectRows, listRows, bookRows, seriesRows] = await Promise.all([
      this.listPublishedSubjects(),
      this.db.select({ slug: lists.slug }).from(lists).where(this.listIsPublic()),
      this.db.select({ slug: books.slug }).from(books),
      this.db.select({ slug: series.slug }).from(series),
    ]);
    return {
      subjects: subjectRows.map((s) => s.slug),
      lists: listRows.map((l) => l.slug),
      books: bookRows.map((b) => b.slug),
      series: seriesRows.map((s) => s.slug),
    };
  }
}
