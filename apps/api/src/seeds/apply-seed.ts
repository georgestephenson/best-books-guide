import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../infra/db/pool.js';
import {
  authors,
  bookAuthors,
  bookSubjects,
  books,
  listItems,
  lists,
  series,
  subjects,
} from '../infra/db/schema/index.js';
import type { SeedData } from './catalogue-data.js';

/**
 * Apply the catalogue seed idempotently (docs/03 §seeds): upsert every entity by its
 * unique slug, then rebuild the join rows and list items. Safe to re-run — a second
 * run converges to the same state rather than duplicating or erroring. Runs in one
 * transaction so a failure leaves the catalogue untouched.
 */
export async function applySeed(db: Database, data: SeedData): Promise<void> {
  await db.transaction(async (tx) => {
    // --- entities: insert-or-update by slug, collect slug → id maps ---
    const subjectRows = await tx
      .insert(subjects)
      .values(data.subjects)
      .onConflictDoUpdate({
        target: subjects.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          position: sql`excluded.position`,
        },
      })
      .returning({ id: subjects.id, slug: subjects.slug });
    const subjectId = new Map(subjectRows.map((r) => [r.slug, r.id]));

    const authorRows = await tx
      .insert(authors)
      .values(data.authors)
      .onConflictDoUpdate({ target: authors.slug, set: { name: sql`excluded.name` } })
      .returning({ id: authors.id, slug: authors.slug });
    const authorId = new Map(authorRows.map((r) => [r.slug, r.id]));

    const seriesId = new Map<string, string>();
    if (data.series.length > 0) {
      const seriesRows = await tx
        .insert(series)
        .values(data.series)
        .onConflictDoUpdate({
          target: series.slug,
          set: { title: sql`excluded.title`, description: sql`excluded.description` },
        })
        .returning({ id: series.id, slug: series.slug });
      for (const r of seriesRows) seriesId.set(r.slug, r.id);
    }

    const bookRows = await tx
      .insert(books)
      .values(
        data.books.map((b) => ({
          slug: b.slug,
          title: b.title,
          subtitle: b.subtitle ?? null,
          description: b.description ?? null,
          firstPublishedYear: b.firstPublishedYear ?? null,
          pageCount: b.pageCount ?? null,
          seriesId: b.seriesSlug ? (seriesId.get(b.seriesSlug) ?? null) : null,
          seriesPosition: b.seriesPosition != null ? String(b.seriesPosition) : null,
        })),
      )
      .onConflictDoUpdate({
        target: books.slug,
        set: {
          title: sql`excluded.title`,
          subtitle: sql`excluded.subtitle`,
          description: sql`excluded.description`,
          firstPublishedYear: sql`excluded.first_published_year`,
          pageCount: sql`excluded.page_count`,
          seriesId: sql`excluded.series_id`,
          seriesPosition: sql`excluded.series_position`,
        },
      })
      .returning({ id: books.id, slug: books.slug });
    const bookId = new Map(bookRows.map((r) => [r.slug, r.id]));
    const allBookIds = [...bookId.values()];

    // --- join rows: replace-in-place so re-runs don't accumulate duplicates ---
    await tx.delete(bookAuthors).where(inArray(bookAuthors.bookId, allBookIds));
    await tx.delete(bookSubjects).where(inArray(bookSubjects.bookId, allBookIds));
    const authorLinks = data.books.flatMap((b) =>
      b.authors.map((a, position) => ({
        bookId: bookId.get(b.slug)!,
        authorId: authorId.get(a)!,
        position,
      })),
    );
    if (authorLinks.length > 0) await tx.insert(bookAuthors).values(authorLinks);
    const subjectLinks = data.books.flatMap((b) =>
      b.subjects.map((s) => ({ bookId: bookId.get(b.slug)!, subjectId: subjectId.get(s)! })),
    );
    if (subjectLinks.length > 0) await tx.insert(bookSubjects).values(subjectLinks);

    // --- lists: two passes so a sublist can reference its parent's id ---
    const listRows = await tx
      .insert(lists)
      .values(
        data.lists.map((l) => ({
          slug: l.slug,
          title: l.title,
          subjectId: subjectId.get(l.subject)!,
          intro: l.intro ?? null,
          isPublished: l.published,
        })),
      )
      .onConflictDoUpdate({
        target: lists.slug,
        set: {
          title: sql`excluded.title`,
          subjectId: sql`excluded.subject_id`,
          intro: sql`excluded.intro`,
          isPublished: sql`excluded.is_published`,
        },
      })
      .returning({ id: lists.id, slug: lists.slug });
    const listId = new Map(listRows.map((r) => [r.slug, r.id]));

    for (const l of data.lists) {
      const parentId = l.parent ? (listId.get(l.parent) ?? null) : null;
      await tx
        .update(lists)
        .set({ parentListId: parentId })
        .where(eq(lists.id, listId.get(l.slug)!));
    }

    // --- list items: rebuild each list's ranked items (rank = array order) ---
    const allListIds = [...listId.values()];
    await tx.delete(listItems).where(inArray(listItems.listId, allListIds));
    const items = data.lists.flatMap((l) =>
      l.items.map((item, i) => ({
        listId: listId.get(l.slug)!,
        bookId: item.book ? bookId.get(item.book)! : null,
        seriesId: item.series ? seriesId.get(item.series)! : null,
        rank: i + 1,
        blurb: item.blurb ?? null,
      })),
    );
    if (items.length > 0) await tx.insert(listItems).values(items);
  });
}
