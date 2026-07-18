import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BookDetail, ListDetail, SeriesDetail, SubjectDetail } from '@bestbooks/shared';
import {
  authors,
  bookAuthors,
  bookSubjects,
  books,
  listItems,
  lists,
  series,
  subjects,
} from '../src/infra/db/schema/index.js';
import { testDb, resetStores, closeStores, buildTestServer } from './harness.js';

// A coherent public-domain fixture exercising every list shape: flat books, a series
// item, sublists, and unpublished lists that must stay invisible.
async function seed(): Promise<void> {
  const { db } = testDb();

  const [fiction, philosophy] = await db
    .insert(subjects)
    .values([
      { name: 'Fiction', slug: 'fiction', position: 0 },
      { name: 'Philosophy', slug: 'philosophy', position: 1 },
      { name: 'Empty', slug: 'empty-subject', position: 2 }, // no published list → excluded
    ])
    .returning();

  const [melville, shelley, doyle, plato] = await db
    .insert(authors)
    .values([
      { name: 'Herman Melville', slug: 'herman-melville' },
      { name: 'Mary Shelley', slug: 'mary-shelley' },
      { name: 'Arthur Conan Doyle', slug: 'arthur-conan-doyle' },
      { name: 'Plato', slug: 'plato' },
    ])
    .returning();

  const [holmes] = await db
    .insert(series)
    .values([{ title: 'Sherlock Holmes', slug: 'sherlock-holmes', description: 'The canon.' }])
    .returning();

  const [mobyDick, frankenstein, billyBudd, study, sign, republic] = await db
    .insert(books)
    .values([
      { title: 'Moby-Dick', slug: 'moby-dick', firstPublishedYear: 1851, pageCount: 635 },
      {
        title: 'Frankenstein',
        slug: 'frankenstein',
        firstPublishedYear: 1818,
        coverPath: 'frankenstein.jpg',
      },
      { title: 'Billy Budd', slug: 'billy-budd', firstPublishedYear: 1924 },
      {
        title: 'A Study in Scarlet',
        slug: 'a-study-in-scarlet',
        seriesId: holmes!.id,
        seriesPosition: '1',
      },
      {
        title: 'The Sign of the Four',
        slug: 'the-sign-of-the-four',
        seriesId: holmes!.id,
        seriesPosition: '2',
      },
      { title: 'The Republic', slug: 'the-republic', firstPublishedYear: -380 },
    ])
    .returning();

  await db.insert(bookAuthors).values([
    { bookId: mobyDick!.id, authorId: melville!.id },
    { bookId: billyBudd!.id, authorId: melville!.id },
    { bookId: frankenstein!.id, authorId: shelley!.id },
    { bookId: study!.id, authorId: doyle!.id },
    { bookId: sign!.id, authorId: doyle!.id },
    { bookId: republic!.id, authorId: plato!.id },
  ]);
  await db.insert(bookSubjects).values([
    { bookId: mobyDick!.id, subjectId: fiction!.id },
    { bookId: frankenstein!.id, subjectId: fiction!.id },
    { bookId: billyBudd!.id, subjectId: fiction!.id },
    { bookId: republic!.id, subjectId: philosophy!.id },
  ]);

  // Published top-level list under Fiction, with a book, a series, and a book item.
  const [bestFiction, foundations, parentUnpub] = await db
    .insert(lists)
    .values([
      {
        title: 'Best Fiction',
        slug: 'best-fiction',
        subjectId: fiction!.id,
        intro: 'The essentials.',
        isPublished: true,
      },
      {
        title: 'Foundations of Philosophy',
        slug: 'philosophy-foundations',
        subjectId: philosophy!.id,
        isPublished: true,
      },
      // Unpublished parent — its published sublist must still 404.
      { title: 'Hidden Parent', slug: 'hidden-parent', subjectId: fiction!.id, isPublished: false },
    ])
    .returning();

  const [draftList, ancient] = await db
    .insert(lists)
    .values([
      // Unpublished list under Fiction — invisible everywhere.
      { title: 'Draft List', slug: 'draft-list', subjectId: fiction!.id, isPublished: false },
      // Published sublist of a published parent → visible.
      {
        title: 'Ancient',
        slug: 'ancient-philosophy',
        subjectId: philosophy!.id,
        parentListId: foundations!.id,
        isPublished: true,
      },
      // Published sublist of an UNPUBLISHED parent → not visible.
      {
        title: 'Orphan',
        slug: 'orphan-sublist',
        subjectId: fiction!.id,
        parentListId: parentUnpub!.id,
        isPublished: true,
      },
    ])
    .returning();

  await db.insert(listItems).values([
    { listId: bestFiction!.id, bookId: mobyDick!.id, rank: 1, blurb: 'The white whale.' },
    { listId: bestFiction!.id, seriesId: holmes!.id, rank: 2, blurb: 'Deduction, serialised.' },
    { listId: bestFiction!.id, bookId: frankenstein!.id, rank: 3 },
    { listId: ancient!.id, bookId: republic!.id, rank: 1, blurb: 'The cave.' },
    // Moby-Dick also on the draft (unpublished) list — must not leak into appearances.
    { listId: draftList!.id, bookId: mobyDick!.id, rank: 1 },
  ]);
}

describe('public catalogue API (integration)', () => {
  beforeAll(async () => {
    await resetStores();
    await seed();
  });
  afterAll(closeStores);

  async function get(url: string) {
    const { app } = buildTestServer();
    await app.ready();
    try {
      return await app.inject({ method: 'GET', url });
    } finally {
      await app.close();
    }
  }

  it('GET /subjects lists only subjects with a published list, ordered', async () => {
    const res = await get('/api/v1/subjects');
    expect(res.statusCode).toBe(200);
    const body = res.json() as SubjectDetail[];
    expect(body.map((s) => s.slug)).toEqual(['fiction', 'philosophy']); // empty-subject excluded
    const fiction = body[0]!;
    expect(fiction.lists.map((l) => l.slug)).toEqual(['best-fiction']); // draft excluded
    expect(fiction.lists[0]).toMatchObject({ itemCount: 3, title: 'Best Fiction' });
  });

  it('GET /subjects/:slug 200 with lists, 404 for unknown', async () => {
    const ok = await get('/api/v1/subjects/philosophy');
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as SubjectDetail).lists.map((l) => l.slug)).toEqual([
      'philosophy-foundations',
    ]);
    const missing = await get('/api/v1/subjects/nope');
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['content-type']).toContain('application/problem+json');
  });

  it('GET /lists/:slug returns ranked book + series items with blurbs and sublists', async () => {
    const res = await get('/api/v1/lists/best-fiction');
    expect(res.statusCode).toBe(200);
    const list = res.json() as ListDetail;
    expect(list.subject.slug).toBe('fiction');
    expect(list.items).toHaveLength(3);
    expect(list.items[0]).toMatchObject({ type: 'book', rank: 1, blurb: 'The white whale.' });
    expect(list.items[0]!.type === 'book' && list.items[0]!.book.slug).toBe('moby-dick');
    expect(list.items[1]).toMatchObject({ type: 'series', rank: 2 });
    expect(list.items[1]!.type === 'series' && list.items[1]!.series.slug).toBe('sherlock-holmes');
    expect(list.items[1]!.type === 'series' && list.items[1]!.series.bookCount).toBe(2);
    // A book with a cover exposes the /covers/ URL; coverless books stay null.
    expect(list.items[2]!.type === 'book' && list.items[2]!.book.coverUrl).toBe(
      '/covers/frankenstein.jpg',
    );
  });

  it('GET /lists/:slug on a parent shows its published sublists as a map', async () => {
    const res = await get('/api/v1/lists/philosophy-foundations');
    const list = res.json() as ListDetail;
    expect(list.sublists.map((s) => s.slug)).toEqual(['ancient-philosophy']);
    expect(list.parent).toBeNull();
  });

  it('GET /lists/:slug on a sublist exposes its parent', async () => {
    const res = await get('/api/v1/lists/ancient-philosophy');
    const list = res.json() as ListDetail;
    expect(list.parent).toMatchObject({ slug: 'philosophy-foundations' });
    expect(list.items[0]!.type === 'book' && list.items[0]!.book.slug).toBe('the-republic');
  });

  it('hides unpublished lists and sublists of unpublished parents (404)', async () => {
    expect((await get('/api/v1/lists/draft-list')).statusCode).toBe(404);
    expect((await get('/api/v1/lists/hidden-parent')).statusCode).toBe(404);
    expect((await get('/api/v1/lists/orphan-sublist')).statusCode).toBe(404);
  });

  it('GET /books/:slug assembles authors, list appearances, and the related strip', async () => {
    const res = await get('/api/v1/books/moby-dick');
    expect(res.statusCode).toBe(200);
    const book = res.json() as BookDetail;
    expect(book.authors).toEqual([{ slug: 'herman-melville', name: 'Herman Melville' }]);
    expect(book.subjects.map((s) => s.slug)).toEqual(['fiction']);
    expect(book.coverUrl).toBeNull();
    // Only the published appearance; the draft list is filtered out.
    expect(book.listAppearances).toEqual([
      { listSlug: 'best-fiction', listTitle: 'Best Fiction', rank: 1 },
    ]);
    const reasons = Object.fromEntries(book.related.map((r) => [r.slug, r.reason]));
    expect(reasons['billy-budd']).toBe('same-author'); // shares Melville
    expect(reasons['frankenstein']).toBe('co-listed'); // both on Best Fiction
  });

  it('GET /books/:slug 404 for unknown', async () => {
    expect((await get('/api/v1/books/nope')).statusCode).toBe(404);
  });

  it('GET /books searches by title/author and filters by subject', async () => {
    const byTitle = await get('/api/v1/books?search=moby');
    expect((byTitle.json() as { items: BookDetail[] }).items.map((b) => b.slug)).toEqual([
      'moby-dick',
    ]);
    const byAuthor = await get('/api/v1/books?search=doyle');
    const slugs = (byAuthor.json() as { items: BookDetail[] }).items.map((b) => b.slug).sort();
    expect(slugs).toEqual(['a-study-in-scarlet', 'the-sign-of-the-four']);
    const bySubject = await get('/api/v1/books?subject=philosophy');
    expect((bySubject.json() as { items: BookDetail[] }).items.map((b) => b.slug)).toEqual([
      'the-republic',
    ]);
  });

  it('GET /books paginates by cursor', async () => {
    const first = await get('/api/v1/books?limit=2');
    const page1 = first.json() as { items: { slug: string }[]; nextCursor: string | null };
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const second = await get(
      `/api/v1/books?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
    );
    const page2 = second.json() as { items: { slug: string }[] };
    // No overlap between pages, and order is stable (by title).
    const overlap = page1.items.some((a) => page2.items.some((b) => b.slug === a.slug));
    expect(overlap).toBe(false);
  });

  it('GET /series/:slug returns books in reading order', async () => {
    const res = await get('/api/v1/series/sherlock-holmes');
    expect(res.statusCode).toBe(200);
    const s = res.json() as SeriesDetail;
    expect(s.books.map((b) => b.slug)).toEqual(['a-study-in-scarlet', 'the-sign-of-the-four']);
    expect(s.books[0]!.seriesPosition).toBe(1);
    expect((await get('/api/v1/series/nope')).statusCode).toBe(404);
  });

  it('GET /sitemap.xml lists public slugs and excludes unpublished lists', async () => {
    const res = await get('/sitemap.xml');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    const xml = res.body;
    expect(xml).toContain('<loc>http://localhost:5173/lists/best-fiction</loc>');
    expect(xml).toContain('<loc>http://localhost:5173/lists/ancient-philosophy</loc>');
    expect(xml).toContain('<loc>http://localhost:5173/books/moby-dick</loc>');
    expect(xml).toContain('<loc>http://localhost:5173/series/sherlock-holmes</loc>');
    // Unpublished + orphan sublists must not appear.
    expect(xml).not.toContain('/lists/draft-list');
    expect(xml).not.toContain('/lists/orphan-sublist');
  });

  it('GET /robots.txt points at the sitemap', async () => {
    const res = await get('/robots.txt');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('Sitemap: http://localhost:5173/sitemap.xml');
    expect(res.body).toContain('Disallow: /api/');
  });
});
