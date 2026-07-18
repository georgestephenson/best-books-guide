import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ListDetail, SubjectDetail } from '@bestbooks/shared';
import { applySeed } from '../src/seeds/apply-seed.js';
import { catalogueSeed } from '../src/seeds/catalogue-data.js';
import { testDb, resetStores, closeStores, buildTestServer } from './harness.js';

async function get<T>(url: string): Promise<T> {
  const { app } = buildTestServer();
  await app.ready();
  try {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    return res.json() as T;
  } finally {
    await app.close();
  }
}

// The seed is shippable content, so it's tested end-to-end: apply it, then browse it
// through the public API exactly as a visitor would (the M3 exit criteria).
describe('catalogue seed (integration)', () => {
  beforeEach(resetStores);
  afterAll(closeStores);

  it('is idempotent — applying twice converges instead of duplicating', async () => {
    const { db } = testDb();
    await applySeed(db, catalogueSeed);
    await applySeed(db, catalogueSeed); // must not throw or double-insert

    const subjects = await get<SubjectDetail[]>('/api/v1/subjects');
    expect(subjects.map((s) => s.slug)).toEqual(['fiction', 'philosophy', 'science']);
    // The flat list still has exactly its seeded items after a second run.
    const list = await get<ListDetail>('/api/v1/lists/the-essential-novels');
    expect(list.items).toHaveLength(7);
  });

  it('renders a list that holds a series as one ranked slot', async () => {
    const { db } = testDb();
    await applySeed(db, catalogueSeed);

    const list = await get<ListDetail>('/api/v1/lists/the-essential-novels');
    const seriesItem = list.items.find((i) => i.type === 'series');
    expect(seriesItem?.type === 'series' && seriesItem.series.slug).toBe('sherlock-holmes');
    expect(seriesItem?.type === 'series' && seriesItem.series.bookCount).toBe(4);

    // …and the series has its own page with the books in reading order.
    const series = await get<{ books: { slug: string }[] }>('/api/v1/series/sherlock-holmes');
    expect(series.books.map((b) => b.slug)).toEqual([
      'a-study-in-scarlet',
      'the-sign-of-the-four',
      'the-hound-of-the-baskervilles',
      'the-valley-of-fear',
    ]);
  });

  it('nests sublists one level under a parent list', async () => {
    const { db } = testDb();
    await applySeed(db, catalogueSeed);

    const parent = await get<ListDetail>('/api/v1/lists/foundations-of-western-philosophy');
    expect(parent.items).toHaveLength(0);
    expect(parent.sublists.map((s) => s.slug)).toEqual(['ancient-philosophy', 'modern-philosophy']);

    const sublist = await get<ListDetail>('/api/v1/lists/ancient-philosophy');
    expect(sublist.parent?.slug).toBe('foundations-of-western-philosophy');
    expect(sublist.items).toHaveLength(3);
  });
});
