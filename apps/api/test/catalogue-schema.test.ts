import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { subjects, series, books, lists, listItems } from '../src/infra/db/schema/index.js';
import { testDb, resetStores, closeStores } from './harness.js';

// drizzle wraps driver errors, so the SQLSTATE lands on `.cause.code`; raw pool
// queries put it on `.code`. Codes used: 23505 unique_violation, 23514
// check_violation, 23001 restrict_violation (ON DELETE RESTRICT raises this, not 23503).
async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    const found =
      (err as { code?: string; cause?: { code?: string } }).code ??
      (err as { cause?: { code?: string } }).cause?.code;
    expect(found).toBe(code);
    return;
  }
  throw new Error('expected the query to reject, but it resolved');
}

// Minimal fixture builders — enough to hang list_items off real rows.
async function makeSubject(slug: string): Promise<string> {
  const { db } = testDb();
  const [row] = await db.insert(subjects).values({ name: slug, slug }).returning();
  return row!.id;
}
async function makeBook(slug: string): Promise<string> {
  const { db } = testDb();
  const [row] = await db.insert(books).values({ title: slug, slug }).returning();
  return row!.id;
}
async function makeSeries(slug: string): Promise<string> {
  const { db } = testDb();
  const [row] = await db.insert(series).values({ title: slug, slug }).returning();
  return row!.id;
}
async function makeList(slug: string, subjectId: string): Promise<string> {
  const { db } = testDb();
  const [row] = await db.insert(lists).values({ title: slug, slug, subjectId }).returning();
  return row!.id;
}

// Real PostgreSQL 18 (docs/02 §Testing strategy): proves migration 0001_catalogue
// applied and that the constraints docs/03 relies on actually bite.
describe('catalogue schema (integration)', () => {
  beforeEach(resetStores);
  afterAll(closeStores);

  it('created every catalogue table', async () => {
    const { pool } = testDb();
    const names = [
      'subjects',
      'authors',
      'series',
      'books',
      'book_authors',
      'book_subjects',
      'lists',
      'list_items',
    ];
    const { rows } = await pool.query<{ reg: string | null }>(
      `select to_regclass('public.' || t) as reg from unnest($1::text[]) as t`,
      [names],
    );
    expect(rows.map((r) => r.reg)).toEqual(names);
  });

  it('created the GIN trigram indexes for search (docs/03 §indexes)', async () => {
    const { pool } = testDb();
    const { rows } = await pool.query<{ indexname: string }>(
      `select indexname from pg_indexes
       where indexname in ('books_title_trgm', 'authors_name_trgm') order by indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual(['authors_name_trgm', 'books_title_trgm']);
  });

  it('defaults a book to en, rating 0/0, and a v7 id', async () => {
    const { db } = testDb();
    const [row] = await db
      .insert(books)
      .values({ title: 'Moby-Dick', slug: 'moby-dick' })
      .returning();
    expect(row!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(row!.language).toBe('en');
    expect(row!.ratingAvg).toBe('0.00'); // numeric(3,2) round-trips as a string
    expect(row!.ratingCount).toBe(0);
    expect(row!.coverPath).toBeNull();
  });

  it('allows two series-items in one list but rejects a duplicate book (NULLs distinct)', async () => {
    const { db } = testDb();
    const subjectId = await makeSubject('history');
    const listId = await makeList('best-history', subjectId);
    const sA = await makeSeries('series-a');
    const sB = await makeSeries('series-b');
    const book = await makeBook('a-book');

    // Two series items (book_id NULL) coexist — the (list_id, book_id) unique sees
    // distinct NULLs, so it doesn't collapse them.
    await db.insert(listItems).values({ listId, seriesId: sA, rank: 1 });
    await db.insert(listItems).values({ listId, seriesId: sB, rank: 2 });

    // The same book twice in one list is rejected.
    await db.insert(listItems).values({ listId, bookId: book, rank: 3 });
    await expectPgError(db.insert(listItems).values({ listId, bookId: book, rank: 4 }), '23505');
  });

  it('requires exactly one of book_id / series_id (num_nonnulls check)', async () => {
    const { db } = testDb();
    const subjectId = await makeSubject('science');
    const listId = await makeList('best-science', subjectId);
    const book = await makeBook('sci-book');
    const ser = await makeSeries('sci-series');

    // Neither set → violates the check.
    await expectPgError(db.insert(listItems).values({ listId, rank: 1 }), '23514');
    // Both set → violates the check.
    await expectPgError(
      db.insert(listItems).values({ listId, bookId: book, seriesId: ser, rank: 1 }),
      '23514',
    );
  });

  it('lets a whole-list reorder swap ranks in one transaction (DEFERRABLE)', async () => {
    const { db } = testDb();
    const subjectId = await makeSubject('philosophy');
    const listId = await makeList('best-philosophy', subjectId);
    const b1 = await makeBook('book-1');
    const b2 = await makeBook('book-2');
    const [itemA] = await db.insert(listItems).values({ listId, bookId: b1, rank: 1 }).returning();
    const [itemB] = await db.insert(listItems).values({ listId, bookId: b2, rank: 2 }).returning();

    // A→2 collides with B mid-transaction; only tolerated because the unique is
    // INITIALLY DEFERRED (checked at COMMIT). An immediate unique would fail here.
    await db.transaction(async (tx) => {
      await tx.update(listItems).set({ rank: 2 }).where(eq(listItems.id, itemA!.id));
      await tx.update(listItems).set({ rank: 1 }).where(eq(listItems.id, itemB!.id));
    });

    const rows = await db
      .select({ id: listItems.id, rank: listItems.rank })
      .from(listItems)
      .where(eq(listItems.listId, listId));
    const ranks = Object.fromEntries(rows.map((r) => [r.id, r.rank]));
    expect(ranks[itemA!.id]).toBe(2);
    expect(ranks[itemB!.id]).toBe(1);
  });

  it('still enforces unique ranks at commit', async () => {
    const { db } = testDb();
    const subjectId = await makeSubject('economics');
    const listId = await makeList('best-economics', subjectId);
    const b1 = await makeBook('econ-1');
    const s1 = await makeSeries('econ-series');
    // Two items land on rank 5 in the same transaction; the deferred check fires at
    // COMMIT and rejects the whole transaction.
    await expectPgError(
      db.transaction(async (tx) => {
        await tx.insert(listItems).values({ listId, bookId: b1, rank: 5 });
        await tx.insert(listItems).values({ listId, seriesId: s1, rank: 5 });
      }),
      '23505',
    );
  });

  it('RESTRICTs deleting a book or subject that is still referenced', async () => {
    const { db } = testDb();
    const subjectId = await makeSubject('fiction');
    const listId = await makeList('best-fiction', subjectId);
    const book = await makeBook('listed-book');
    await db.insert(listItems).values({ listId, bookId: book, rank: 1 });

    // Book is on a list → its delete is RESTRICTed (remove from lists first).
    await expectPgError(db.delete(books).where(eq(books.id, book)), '23001');
    // Subject has a list → RESTRICTed too.
    await expectPgError(db.delete(subjects).where(eq(subjects.id, subjectId)), '23001');
  });
});
