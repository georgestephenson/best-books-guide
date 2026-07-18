import { asc, eq, exists, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ConflictError } from '../../domain/errors.js';
import type {
  AdminCurationRepository,
  AdminListRow,
  AdminListSummaryRow,
  AdminSeriesRow,
  AdminSeriesSummaryRow,
  CreateListInput,
  ListItemInput,
  ListMeta,
  UpdateListInput,
} from '../../app/ports/admin-curation-repository.js';
import type { DeleteResult } from '../../app/ports/admin-catalogue-repository.js';
import type { Database } from './pool.js';
import { books, listItems, lists, series, subjects } from './schema/index.js';

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
}
const isUniqueViolation = (err: unknown): boolean => pgCode(err) === '23505';
const isRestrictViolation = (err: unknown): boolean => pgCode(err) === '23001';

const numOrNull = (v: string | null): number | null => (v === null ? null : Number(v));

export class DrizzleAdminCurationRepository implements AdminCurationRepository {
  constructor(private readonly db: Database) {}

  // --- lists ---
  async listLists(): Promise<AdminListSummaryRow[]> {
    const parent = alias(lists, 'parent');
    return this.db
      .select({
        id: lists.id,
        slug: lists.slug,
        title: lists.title,
        subjectName: subjects.name,
        parentTitle: parent.title,
        isPublished: lists.isPublished,
        itemCount: sql<number>`count(${listItems.id})::int`,
      })
      .from(lists)
      .innerJoin(subjects, eq(subjects.id, lists.subjectId))
      .leftJoin(parent, eq(parent.id, lists.parentListId))
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .groupBy(lists.id, subjects.name, parent.title)
      .orderBy(asc(subjects.name), asc(lists.title));
  }

  async createList(input: CreateListInput): Promise<{ id: string; slug: string }> {
    try {
      const [row] = await this.db
        .insert(lists)
        .values({ title: input.title, slug: input.slug, subjectId: input.subjectId, intro: input.intro })
        .returning({ id: lists.id, slug: lists.slug });
      return row!;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('a list with a similar title already exists');
      throw err;
    }
  }

  async getList(id: string): Promise<AdminListRow | null> {
    const [row] = await this.db.select().from(lists).where(eq(lists.id, id)).limit(1);
    if (!row) return null;
    const itemRows = await this.db
      .select({
        rank: listItems.rank,
        blurb: listItems.blurb,
        bookId: listItems.bookId,
        seriesId: listItems.seriesId,
        bookTitle: books.title,
        seriesTitle: series.title,
      })
      .from(listItems)
      .leftJoin(books, eq(books.id, listItems.bookId))
      .leftJoin(series, eq(series.id, listItems.seriesId))
      .where(eq(listItems.listId, id))
      .orderBy(asc(listItems.rank));
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subjectId: row.subjectId,
      parentListId: row.parentListId,
      intro: row.intro,
      isPublished: row.isPublished,
      items: itemRows.map((r) =>
        r.bookId
          ? { type: 'book', refId: r.bookId, title: r.bookTitle ?? '', rank: r.rank, blurb: r.blurb }
          : { type: 'series', refId: r.seriesId!, title: r.seriesTitle ?? '', rank: r.rank, blurb: r.blurb },
      ),
    };
  }

  async listMeta(id: string): Promise<ListMeta | null> {
    const child = alias(lists, 'child');
    const [row] = await this.db
      .select({
        subjectId: lists.subjectId,
        parentListId: lists.parentListId,
        hasChildren: exists(
          this.db.select({ one: sql`1` }).from(child).where(eq(child.parentListId, lists.id)),
        ),
      })
      .from(lists)
      .where(eq(lists.id, id))
      .limit(1);
    if (!row) return null;
    return { subjectId: row.subjectId, parentListId: row.parentListId, hasChildren: Boolean(row.hasChildren) };
  }

  async updateList(id: string, patch: UpdateListInput): Promise<{ id: string } | null> {
    const [row] = await this.db
      .update(lists)
      .set({
        title: patch.title,
        subjectId: patch.subjectId,
        intro: patch.intro,
        isPublished: patch.isPublished,
        parentListId: patch.parentListId,
      })
      .where(eq(lists.id, id))
      .returning({ id: lists.id });
    return row ?? null;
  }

  async deleteList(id: string): Promise<DeleteResult> {
    try {
      const deleted = await this.db.delete(lists).where(eq(lists.id, id)).returning({ id: lists.id });
      return deleted.length > 0 ? 'ok' : 'not_found';
    } catch (err) {
      if (isRestrictViolation(err)) return 'in_use';
      throw err;
    }
  }

  async setListItems(listId: string, items: ListItemInput[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(listItems).where(eq(listItems.listId, listId));
      if (items.length > 0) {
        await tx.insert(listItems).values(
          items.map((item, i) => ({
            listId,
            bookId: item.bookId,
            seriesId: item.seriesId,
            rank: i + 1,
            blurb: item.blurb,
          })),
        );
      }
    });
  }

  // --- series ---
  async listSeries(): Promise<AdminSeriesSummaryRow[]> {
    return this.db
      .select({
        id: series.id,
        slug: series.slug,
        title: series.title,
        bookCount: sql<number>`count(${books.id})::int`,
      })
      .from(series)
      .leftJoin(books, eq(books.seriesId, series.id))
      .groupBy(series.id)
      .orderBy(asc(series.title));
  }

  async createSeries(input: {
    title: string;
    slug: string;
    description: string | null;
  }): Promise<{ id: string; slug: string }> {
    try {
      const [row] = await this.db
        .insert(series)
        .values(input)
        .returning({ id: series.id, slug: series.slug });
      return row!;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('a series with a similar title already exists');
      throw err;
    }
  }

  async getSeries(id: string): Promise<AdminSeriesRow | null> {
    const [row] = await this.db.select().from(series).where(eq(series.id, id)).limit(1);
    if (!row) return null;
    const bookRows = await this.db
      .select({ id: books.id, title: books.title, seriesPosition: books.seriesPosition })
      .from(books)
      .where(eq(books.seriesId, id))
      .orderBy(sql`${books.seriesPosition} asc nulls last`, asc(books.title));
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      books: bookRows.map((b) => ({ id: b.id, title: b.title, seriesPosition: numOrNull(b.seriesPosition) })),
    };
  }

  async updateSeries(
    id: string,
    patch: { title: string; description: string | null },
  ): Promise<{ id: string } | null> {
    const [row] = await this.db
      .update(series)
      .set(patch)
      .where(eq(series.id, id))
      .returning({ id: series.id });
    return row ?? null;
  }

  async deleteSeries(id: string): Promise<DeleteResult> {
    try {
      const deleted = await this.db.delete(series).where(eq(series.id, id)).returning({ id: series.id });
      return deleted.length > 0 ? 'ok' : 'not_found';
    } catch (err) {
      if (isRestrictViolation(err)) return 'in_use';
      throw err;
    }
  }

  async setSeriesBooks(seriesId: string, bookIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Detach everything currently in the series, then (re)attach in the given order.
      await tx
        .update(books)
        .set({ seriesId: null, seriesPosition: null })
        .where(eq(books.seriesId, seriesId));
      for (const [index, bookId] of bookIds.entries()) {
        await tx
          .update(books)
          .set({ seriesId, seriesPosition: String(index + 1) })
          .where(eq(books.id, bookId));
      }
    });
  }
}
