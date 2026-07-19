import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { InjectOptions } from 'fastify';
import { eq } from 'drizzle-orm';
import { DrizzleUserRepository } from '../src/infra/db/drizzle-user-repository.js';
import { DrizzleReviewRepository } from '../src/infra/db/drizzle-review-repository.js';
import { books, users } from '../src/infra/db/schema/index.js';
import { SEVERE_TERMS } from '../src/infra/moderation/severe-terms.data.js';
import {
  testDb,
  resetStores,
  closeStores,
  buildTestServer,
  tokenFromEmail,
  type TestServer,
} from './harness.js';

const API = '/api/v1';
const PASSWORD = 'correcthorsebattery';

interface Actor {
  token: string;
  headers: { authorization: string };
}

describe('member features — shelves, reviews, moderation, tracking (integration)', () => {
  let app: FastifyInstance;
  let emails: TestServer['emails'];

  const json = <T>(res: { json: () => unknown }): T => res.json() as T;

  async function as(actor: Actor | null, opts: InjectOptions) {
    return app.inject({ ...opts, headers: { ...(actor?.headers ?? {}), ...opts.headers } });
  }

  /** Register (and by default verify) a member, returning a bearer-token actor. */
  async function makeMember(email: string, name: string, verify = true): Promise<Actor> {
    await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: { email, password: PASSWORD, displayName: name },
    });
    if (verify) {
      await app.inject({
        method: 'POST',
        url: `${API}/auth/verify-email`,
        payload: { token: tokenFromEmail(emails.at(-1)!) },
      });
    }
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email, password: PASSWORD },
    });
    const token = json<{ accessToken: string }>(login).accessToken;
    return { token, headers: { authorization: `Bearer ${token}` } };
  }

  async function makeAdmin(email: string, name: string): Promise<Actor> {
    await makeMember(email, name);
    await new DrizzleUserRepository(testDb().db).promoteToAdmin(email);
    // Re-login so the fresh access token carries the admin role claim.
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email, password: PASSWORD },
    });
    const token = json<{ accessToken: string }>(login).accessToken;
    return { token, headers: { authorization: `Bearer ${token}` } };
  }

  /** Seed a subject, two books, a two-book series, and a published list via the admin API. */
  async function seedCatalogue(admin: Actor) {
    const post = (url: string, payload: unknown) =>
      as(admin, { method: 'POST', url: `${API}${url}`, payload });

    const subject = json<{ id: string }>(await post('/admin/subjects', { name: 'History' }));
    const bookA = json<{ id: string; slug: string }>(
      await post('/admin/books', {
        title: 'Atomic Bomb',
        authors: ['Rhodes'],
        subjectIds: [subject.id],
      }),
    );
    const bookB = json<{ id: string; slug: string }>(
      await post('/admin/books', {
        title: 'Guns Germs Steel',
        authors: ['Diamond'],
        subjectIds: [subject.id],
      }),
    );
    const seriesRes = json<{ id: string; slug: string }>(
      await post('/admin/series', { title: 'A Saga' }),
    );
    const seriesBookX = json<{ id: string; slug: string }>(
      await post('/admin/books', {
        title: 'Saga One',
        authors: ['Author'],
        subjectIds: [subject.id],
      }),
    );
    const seriesBookY = json<{ id: string; slug: string }>(
      await post('/admin/books', {
        title: 'Saga Two',
        authors: ['Author'],
        subjectIds: [subject.id],
      }),
    );
    await as(admin, {
      method: 'PUT',
      url: `${API}/admin/series/${seriesRes.id}/books`,
      payload: { bookIds: [seriesBookX.id, seriesBookY.id] },
    });

    const list = json<{ id: string; slug: string }>(
      await post('/admin/lists', { title: 'Best History Books', subjectId: subject.id }),
    );
    // A book item + a series item (which expands to two books) → 3 books total.
    await as(admin, {
      method: 'PUT',
      url: `${API}/admin/lists/${list.id}/items`,
      payload: { items: [{ bookId: bookA.id }, { seriesId: seriesRes.id }] },
    });
    await as(admin, {
      method: 'PATCH',
      url: `${API}/admin/lists/${list.id}`,
      payload: { title: 'Best History Books', subjectId: subject.id, isPublished: true },
    });

    return { subject, bookA, bookB, seriesBookX, seriesBookY, series: seriesRes, list };
  }

  beforeEach(async () => {
    await resetStores();
    const server = buildTestServer();
    app = server.app;
    emails = server.emails;
    await app.ready();
  });
  afterAll(closeStores);

  // --- F3 shelves ---
  describe('reading status (shelves)', () => {
    it('sets, reads, groups, and removes shelves; defaults finished_on to today', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA, bookB } = await seedCatalogue(admin);
      const reader = await makeMember('reader@example.com', 'Reader');

      // want_to_read
      const set = await as(reader, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/status`,
        payload: { status: 'want_to_read' },
      });
      expect(set.statusCode).toBe(200);
      expect(json<{ status: string; finishedOn: string | null }>(set)).toMatchObject({
        status: 'want_to_read',
        finishedOn: null,
      });

      // finished without a date → today
      const fin = await as(reader, {
        method: 'PUT',
        url: `${API}/me/books/${bookB.slug}/status`,
        payload: { status: 'finished' },
      });
      const today = new Date().toISOString().slice(0, 10);
      expect(json<{ finishedOn: string }>(fin).finishedOn).toBe(today);

      // My Books grouped
      const mine = json<Record<string, { book: { slug: string } }[]>>(
        await as(reader, { method: 'GET', url: `${API}/me/books` }),
      );
      expect(mine.want_to_read.map((r) => r.book.slug)).toEqual([bookA.slug]);
      expect(mine.finished.map((r) => r.book.slug)).toEqual([bookB.slug]);
      expect(mine.reading).toEqual([]);

      // viewer state for a book
      const viewer = json<{ status: string | null }>(
        await as(reader, { method: 'GET', url: `${API}/me/books/${bookA.slug}` }),
      );
      expect(viewer.status).toBe('want_to_read');

      // remove
      const del = await as(reader, {
        method: 'DELETE',
        url: `${API}/me/books/${bookA.slug}/status`,
      });
      expect(del.statusCode).toBe(204);
      const after = json<Record<string, unknown[]>>(
        await as(reader, { method: 'GET', url: `${API}/me/books` }),
      );
      expect(after.want_to_read).toEqual([]);
    });

    it('rejects an unknown book (404) and requires a token (401)', async () => {
      const reader = await makeMember('reader@example.com', 'Reader');
      expect(
        (
          await as(reader, {
            method: 'PUT',
            url: `${API}/me/books/nope/status`,
            payload: { status: 'reading' },
          })
        ).statusCode,
      ).toBe(404);
      expect((await as(null, { method: 'GET', url: `${API}/me/books` })).statusCode).toBe(401);
    });
  });

  // --- F4/F5 ratings & reviews + aggregate maintenance ---
  describe('ratings & reviews', () => {
    it('a bare rating and a written review update the book aggregate', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      const bob = await makeMember('bob@example.com', 'Bob');

      // Alice: bare 4-star rating (no body)
      await as(alice, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 4 },
      });
      // Bob: 2-star written review
      await as(bob, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 2, body: 'A thoughtful but flawed account.' },
      });

      const book = json<{ ratingAvg: number; ratingCount: number }>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }),
      );
      expect(book.ratingCount).toBe(2);
      expect(book.ratingAvg).toBe(3); // (4 + 2) / 2

      // Public reviews list shows only the written one's text; both are present.
      const reviews = json<{ body: string | null; displayName: string }[]>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}/reviews` }),
      );
      expect(reviews).toHaveLength(2);
      expect(reviews.some((r) => r.body === 'A thoughtful but flawed account.')).toBe(true);
      expect(reviews.some((r) => r.body === null)).toBe(true);
    });

    it('editing a review changes the aggregate; deleting removes it', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');

      await as(alice, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 5 },
      });
      let book = json<{ ratingAvg: number; ratingCount: number }>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }),
      );
      expect(book).toMatchObject({ ratingAvg: 5, ratingCount: 1 });

      // Edit down to 3
      await as(alice, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 3 },
      });
      book = json(await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }));
      expect(book).toMatchObject({ ratingAvg: 3, ratingCount: 1 });

      // Delete
      expect(
        (await as(alice, { method: 'DELETE', url: `${API}/me/books/${bookA.slug}/review` }))
          .statusCode,
      ).toBe(204);
      book = json(await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }));
      expect(book).toMatchObject({ ratingAvg: 0, ratingCount: 0 });
    });

    it('a verified email is required to write a review', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const unverified = await makeMember('nope@example.com', 'Nope', false);
      const res = await as(unverified, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 5 },
      });
      expect(res.statusCode).toBe(403);
    });

    it('never drifts the aggregate under concurrent review writes', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);

      // Exercise the repository's per-book lock directly: 10 distinct members write
      // reviews for the same book at once. Without the lock the recompute would race
      // and the count would drift below 10 (docs/03 exit criterion). Going straight to
      // the repo keeps this about concurrency, not the per-IP auth rate limits a burst
      // of registrations would hit.
      const db = testDb().db;
      const repo = new DrizzleReviewRepository(db);
      const bookId = (await repo.findBookIdBySlug(bookA.slug))!;

      const ratings = [5, 4, 3, 2, 1, 5, 4, 3, 2, 1];
      const userRows = await db
        .insert(users)
        .values(
          ratings.map((_, i) => ({
            email: `conc${i}@example.com`,
            passwordHash: 'x',
            displayName: `Conc ${i}`,
          })),
        )
        .returning({ id: users.id });

      await Promise.all(
        userRows.map((u, i) =>
          repo.upsertReview({ userId: u.id, bookId, rating: ratings[i]!, body: null }, null),
        ),
      );

      const [book] = await db.select().from(books).where(eq(books.id, bookId));
      const expectedAvg =
        Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
      expect(book!.ratingCount).toBe(ratings.length);
      expect(Number(book!.ratingAvg)).toBeCloseTo(expectedAvg, 2);
    });
  });

  // --- F5 automated language screen ---
  describe('automated language screen', () => {
    it('publishes clean text with no report', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      await as(alice, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 5, body: 'A genuinely wonderful, careful book.' },
      });
      const queue = json<unknown[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(queue).toEqual([]);
    });

    it('mild profanity publishes but auto-reports into the queue', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      const review = json<{ isHidden: boolean }>(
        await as(alice, {
          method: 'PUT',
          url: `${API}/me/books/${bookA.slug}/review`,
          payload: { rating: 2, body: 'This book is shit, honestly.' },
        }),
      );
      expect(review.isHidden).toBe(false); // still visible
      // Public list shows it
      const pub = json<unknown[]>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}/reviews` }),
      );
      expect(pub).toHaveLength(1);
      // But it's queued for a human, with a null reporter (automated).
      const queue = json<{ reason: string; reporterName: string | null }[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ reason: 'language', reporterName: null });
    });

    it('a severe term auto-hides the review and files a system report', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      const review = json<{ isHidden: boolean; hiddenReason: string | null }>(
        await as(alice, {
          method: 'PUT',
          url: `${API}/me/books/${bookA.slug}/review`,
          // Build a severe body from the curated list without spelling it here.
          payload: { rating: 1, body: `you are a ${SEVERE_TERMS[0]}` },
        }),
      );
      expect(review.isHidden).toBe(true);
      expect(review.hiddenReason).toContain('language');

      // Hidden from the public list…
      const pub = json<unknown[]>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}/reviews` }),
      );
      expect(pub).toEqual([]);
      // …but the author still sees it flagged.
      const viewer = json<{ review: { isHidden: boolean } | null }>(
        await as(alice, { method: 'GET', url: `${API}/me/books/${bookA.slug}` }),
      );
      expect(viewer.review?.isHidden).toBe(true);
      // And it's queued.
      const queue = json<unknown[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(queue).toHaveLength(1);
    });

    it('re-submitting clean text clears the prior automated report and un-hides', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      await as(alice, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/review`,
        payload: { rating: 1, body: `a ${SEVERE_TERMS[1]} book` },
      });
      // Edit to clean text
      const edited = json<{ isHidden: boolean }>(
        await as(alice, {
          method: 'PUT',
          url: `${API}/me/books/${bookA.slug}/review`,
          payload: { rating: 4, body: 'On reflection, a fine book.' },
        }),
      );
      expect(edited.isHidden).toBe(false);
      const queue = json<unknown[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(queue).toEqual([]);
    });
  });

  // --- F5 reporting + F6 moderation ---
  describe('reporting & moderation', () => {
    async function setup() {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const author = await makeMember('author@example.com', 'Author');
      const reporter = await makeMember('reporter@example.com', 'Reporter');
      const reviewId = json<{ id: string }>(
        await as(author, {
          method: 'PUT',
          url: `${API}/me/books/${bookA.slug}/review`,
          payload: { rating: 3, body: 'Spoiler: everyone dies.' },
        }),
      ).id;
      return { admin, bookA, author, reporter, reviewId };
    }

    it('a member reports a review once; a second report is a 409', async () => {
      const { reporter, reviewId } = await setup();
      expect(
        (
          await as(reporter, {
            method: 'POST',
            url: `${API}/reviews/${reviewId}/report`,
            payload: { reason: 'spoilers' },
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (
          await as(reporter, {
            method: 'POST',
            url: `${API}/reviews/${reviewId}/report`,
            payload: { reason: 'spoilers' },
          })
        ).statusCode,
      ).toBe(409);
    });

    it('reporting a missing review is a 404', async () => {
      const { reporter } = await setup();
      expect(
        (
          await as(reporter, {
            method: 'POST',
            url: `${API}/reviews/00000000-0000-0000-0000-000000000000/report`,
            payload: { reason: 'spam' },
          })
        ).statusCode,
      ).toBe(404);
    });

    it('admin hides a reported review (dropping it from public + aggregate), then unhides', async () => {
      const { admin, bookA, reporter, reviewId } = await setup();
      await as(reporter, {
        method: 'POST',
        url: `${API}/reviews/${reviewId}/report`,
        payload: { reason: 'spoilers' },
      });

      // Before hide: visible, counts once.
      let book = json<{ ratingCount: number }>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }),
      );
      expect(book.ratingCount).toBe(1);

      // Hide it.
      expect(
        (
          await as(admin, {
            method: 'POST',
            url: `${API}/admin/reviews/${reviewId}/hide`,
            payload: { reason: 'Spoilers without warning' },
          })
        ).statusCode,
      ).toBe(204);

      // Gone from public + aggregate; queue emptied (report resolved).
      const pub = json<unknown[]>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}/reviews` }),
      );
      expect(pub).toEqual([]);
      book = json(await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }));
      expect(book.ratingCount).toBe(0);
      const queue = json<unknown[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(queue).toEqual([]);

      // Unhide restores it.
      expect(
        (await as(admin, { method: 'POST', url: `${API}/admin/reviews/${reviewId}/unhide` }))
          .statusCode,
      ).toBe(204);
      book = json(await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}` }));
      expect(book.ratingCount).toBe(1);
    });

    it('admin can dismiss (resolve) a report without hiding', async () => {
      const { admin, bookA, reporter, reviewId } = await setup();
      await as(reporter, {
        method: 'POST',
        url: `${API}/reviews/${reviewId}/report`,
        payload: { reason: 'other', note: 'looks fine to me actually' },
      });
      const queue = json<{ id: string }[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(queue).toHaveLength(1);
      expect(
        (
          await as(admin, {
            method: 'POST',
            url: `${API}/admin/reports/${queue[0]!.id}/resolve`,
          })
        ).statusCode,
      ).toBe(204);
      // Review stays visible.
      const pub = json<unknown[]>(
        await as(null, { method: 'GET', url: `${API}/books/${bookA.slug}/reviews` }),
      );
      expect(pub).toHaveLength(1);
      const after = json<unknown[]>(
        await as(admin, { method: 'GET', url: `${API}/admin/reviews/reports` }),
      );
      expect(after).toEqual([]);
    });

    it('the moderation queue is admin-only', async () => {
      const { reporter } = await setup();
      expect(
        (await as(reporter, { method: 'GET', url: `${API}/admin/reviews/reports` })).statusCode,
      ).toBe(403);
    });
  });

  // --- F7 track a list ---
  describe('track a list', () => {
    it('tracks, computes progress across books + series + sublists, and untracks', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const seed = await seedCatalogue(admin);
      const reader = await makeMember('reader@example.com', 'Reader');

      // Track it — list has 3 books (bookA + 2 series books).
      const track = await as(reader, {
        method: 'PUT',
        url: `${API}/me/lists/${seed.list.slug}`,
      });
      expect(track.statusCode).toBe(200);
      expect(json<{ tracked: boolean }>(track).tracked).toBe(true);

      // No progress yet.
      let tracked = json<{ progress: { total: number; pctFinished: number } }[]>(
        await as(reader, { method: 'GET', url: `${API}/me/lists` }),
      );
      expect(tracked).toHaveLength(1);
      expect(tracked[0]!.progress).toMatchObject({
        total: 3,
        finished: 0,
        reading: 0,
        pctFinished: 0,
      });

      // Finish bookA and start one series book.
      await as(reader, {
        method: 'PUT',
        url: `${API}/me/books/${seed.bookA.slug}/status`,
        payload: { status: 'finished' },
      });
      await as(reader, {
        method: 'PUT',
        url: `${API}/me/books/${seed.seriesBookX.slug}/status`,
        payload: { status: 'reading' },
      });

      tracked = json(await as(reader, { method: 'GET', url: `${API}/me/lists` }));
      expect(tracked[0]!.progress).toMatchObject({
        total: 3,
        finished: 1,
        reading: 1,
        pctFinished: 33,
        pctReading: 33,
      });

      // Tracking flag for the list page.
      expect(
        json<{ tracked: boolean }>(
          await as(reader, { method: 'GET', url: `${API}/me/lists/${seed.list.slug}/tracking` }),
        ).tracked,
      ).toBe(true);

      // Untrack.
      expect(
        json<{ tracked: boolean }>(
          await as(reader, { method: 'DELETE', url: `${API}/me/lists/${seed.list.slug}` }),
        ).tracked,
      ).toBe(false);
      expect(json<unknown[]>(await as(reader, { method: 'GET', url: `${API}/me/lists` }))).toEqual(
        [],
      );
    });

    it('cannot track an unpublished or unknown list (404)', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const subject = json<{ id: string }>(
        await as(admin, { method: 'POST', url: `${API}/admin/subjects`, payload: { name: 'Sci' } }),
      );
      const list = json<{ slug: string }>(
        await as(admin, {
          method: 'POST',
          url: `${API}/admin/lists`,
          payload: { title: 'Draft List', subjectId: subject.id },
        }),
      );
      const reader = await makeMember('reader@example.com', 'Reader');
      expect(
        (await as(reader, { method: 'PUT', url: `${API}/me/lists/${list.slug}` })).statusCode,
      ).toBe(404);
      expect((await as(reader, { method: 'PUT', url: `${API}/me/lists/ghost` })).statusCode).toBe(
        404,
      );
    });
  });

  // --- edge cases that exercise the remaining use-case branches ---
  describe('edge cases', () => {
    it('honours explicit started/finished dates on a shelf', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const reader = await makeMember('reader@example.com', 'Reader');
      const res = await as(reader, {
        method: 'PUT',
        url: `${API}/me/books/${bookA.slug}/status`,
        payload: { status: 'finished', startedOn: '2026-01-02', finishedOn: '2026-03-04' },
      });
      expect(json<{ startedOn: string; finishedOn: string }>(res)).toMatchObject({
        status: 'finished',
        startedOn: '2026-01-02',
        finishedOn: '2026-03-04',
      });
    });

    it('returns empty viewer state for an untouched book', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const reader = await makeMember('reader@example.com', 'Reader');
      const viewer = json<{ status: null; startedOn: null; finishedOn: null; review: null }>(
        await as(reader, { method: 'GET', url: `${API}/me/books/${bookA.slug}` }),
      );
      expect(viewer).toEqual({ status: null, startedOn: null, finishedOn: null, review: null });
    });

    it('treats a whitespace-only body as a bare rating', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      const review = json<{ body: string | null }>(
        await as(alice, {
          method: 'PUT',
          url: `${API}/me/books/${bookA.slug}/review`,
          payload: { rating: 4, body: '   ' },
        }),
      );
      expect(review.body).toBeNull();
    });

    it('404s deleting a review that does not exist', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { bookA } = await seedCatalogue(admin);
      const alice = await makeMember('alice@example.com', 'Alice');
      expect(
        (await as(alice, { method: 'DELETE', url: `${API}/me/books/${bookA.slug}/review` }))
          .statusCode,
      ).toBe(404);
    });

    it('reports list tracking state (false, then true)', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const { list } = await seedCatalogue(admin);
      const reader = await makeMember('reader@example.com', 'Reader');
      expect(
        json<{ tracked: boolean }>(
          await as(reader, { method: 'GET', url: `${API}/me/lists/${list.slug}/tracking` }),
        ).tracked,
      ).toBe(false);
      await as(reader, { method: 'PUT', url: `${API}/me/lists/${list.slug}` });
      expect(
        json<{ tracked: boolean }>(
          await as(reader, { method: 'GET', url: `${API}/me/lists/${list.slug}/tracking` }),
        ).tracked,
      ).toBe(true);
    });

    it('404s the tracking check for an unpublished list', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      const subject = json<{ id: string }>(
        await as(admin, { method: 'POST', url: `${API}/admin/subjects`, payload: { name: 'Sci' } }),
      );
      const list = json<{ slug: string }>(
        await as(admin, {
          method: 'POST',
          url: `${API}/admin/lists`,
          payload: { title: 'Draft', subjectId: subject.id },
        }),
      );
      const reader = await makeMember('reader@example.com', 'Reader');
      expect(
        (await as(reader, { method: 'GET', url: `${API}/me/lists/${list.slug}/tracking` }))
          .statusCode,
      ).toBe(404);
    });

    it('404s member reads/writes that name an unknown book', async () => {
      const reader = await makeMember('reader@example.com', 'Reader');
      // public reviews for a missing book
      expect(
        (await as(null, { method: 'GET', url: `${API}/books/ghost-book/reviews` })).statusCode,
      ).toBe(404);
      // viewer state for a missing book
      expect(
        (await as(reader, { method: 'GET', url: `${API}/me/books/ghost-book` })).statusCode,
      ).toBe(404);
      // deleting a review on a missing book
      expect(
        (await as(reader, { method: 'DELETE', url: `${API}/me/books/ghost-book/review` }))
          .statusCode,
      ).toBe(404);
    });

    it('404s moderation actions on a missing review/report', async () => {
      const admin = await makeAdmin('ed@example.com', 'Ed');
      await seedCatalogue(admin);
      const ghost = '00000000-0000-0000-0000-000000000000';
      expect(
        (
          await as(admin, {
            method: 'POST',
            url: `${API}/admin/reviews/${ghost}/hide`,
            payload: { reason: 'x' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await as(admin, { method: 'POST', url: `${API}/admin/reviews/${ghost}/unhide` }))
          .statusCode,
      ).toBe(404);
      expect(
        (await as(admin, { method: 'POST', url: `${API}/admin/reports/${ghost}/resolve` }))
          .statusCode,
      ).toBe(404);
    });
  });
});
