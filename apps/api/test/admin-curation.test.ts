import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DrizzleUserRepository } from '../src/infra/db/drizzle-user-repository.js';
import { testDb, resetStores, closeStores, buildTestServer } from './harness.js';

const API = '/api/v1';

async function adminToken(app: FastifyInstance): Promise<string> {
  const email = 'ed@example.com';
  await app.inject({
    method: 'POST',
    url: `${API}/auth/register`,
    payload: { email, password: 'correcthorsebattery', displayName: 'Ed' },
  });
  await new DrizzleUserRepository(testDb().db).promoteToAdmin(email);
  const login = await app.inject({
    method: 'POST',
    url: `${API}/auth/login`,
    payload: { email, password: 'correcthorsebattery' },
  });
  return (login.json() as { accessToken: string }).accessToken;
}

describe('admin curation — lists & series (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let auth: { authorization: string };

  // Ids we build up per test.
  async function post(url: string, payload: unknown) {
    return app.inject({ method: 'POST', url: `${API}${url}`, headers: auth, payload });
  }
  async function put(url: string, payload: unknown) {
    return app.inject({ method: 'PUT', url: `${API}${url}`, headers: auth, payload });
  }

  beforeEach(async () => {
    await resetStores();
    app = buildTestServer().app;
    await app.ready();
    token = await adminToken(app);
    auth = { authorization: `Bearer ${token}` };
  });
  afterAll(closeStores);

  async function seedSubjectAndBooks() {
    const subject = (await post('/admin/subjects', { name: 'Fiction' })).json() as { id: string };
    const bookA = (
      await post('/admin/books', {
        title: 'Moby-Dick',
        authors: ['Melville'],
        subjectIds: [subject.id],
      })
    ).json() as { id: string };
    const bookB = (
      await post('/admin/books', {
        title: 'Frankenstein',
        authors: ['Shelley'],
        subjectIds: [subject.id],
      })
    ).json() as { id: string };
    const seriesRes = (await post('/admin/series', { title: 'Sherlock Holmes' })).json() as {
      id: string;
      slug: string;
    };
    return { subject, bookA, bookB, series: seriesRes };
  }

  it('builds a list with book + series items and publishes it', async () => {
    const { subject, bookA, series } = await seedSubjectAndBooks();
    const list = (
      await post('/admin/lists', { title: 'Best Fiction', subjectId: subject.id })
    ).json() as {
      id: string;
      slug: string;
    };

    // Unpublished → invisible to the public.
    expect((await app.inject({ method: 'GET', url: `${API}/lists/${list.slug}` })).statusCode).toBe(
      404,
    );

    // Set ranked items: a book then the series.
    const withItems = await put(`/admin/lists/${list.id}/items`, {
      items: [{ bookId: bookA.id, blurb: 'The whale.' }, { seriesId: series.id }],
    });
    expect(withItems.statusCode).toBe(200);
    expect((withItems.json() as { items: { type: string }[] }).items.map((i) => i.type)).toEqual([
      'book',
      'series',
    ]);

    // Publish via update, then it's public with its items in order.
    await app.inject({
      method: 'PATCH',
      url: `${API}/admin/lists/${list.id}`,
      headers: auth,
      payload: { title: 'Best Fiction', subjectId: subject.id, isPublished: true },
    });
    const pub = await app.inject({ method: 'GET', url: `${API}/lists/${list.slug}` });
    expect(pub.statusCode).toBe(200);
    expect((pub.json() as { items: { rank: number }[] }).items).toHaveLength(2);
  });

  it('rejects invalid list items (two targets, or a duplicate)', async () => {
    const { subject, bookA } = await seedSubjectAndBooks();
    const list = (await post('/admin/lists', { title: 'X', subjectId: subject.id })).json() as {
      id: string;
    };
    const both = await put(`/admin/lists/${list.id}/items`, {
      items: [{ bookId: bookA.id, seriesId: 'x' }],
    });
    expect(both.statusCode).toBe(422);
    const dup = await put(`/admin/lists/${list.id}/items`, {
      items: [{ bookId: bookA.id }, { bookId: bookA.id }],
    });
    expect(dup.statusCode).toBe(422);
  });

  it('treats an empty-string parentListId as top-level (regression: 500 on "")', async () => {
    const { subject } = await seedSubjectAndBooks();
    const list = (await post('/admin/lists', { title: 'Top', subjectId: subject.id })).json() as {
      id: string;
    };
    const res = await app.inject({
      method: 'PATCH',
      url: `${API}/admin/lists/${list.id}`,
      headers: auth,
      payload: { title: 'Top', subjectId: subject.id, isPublished: true, parentListId: '' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { parentListId: string | null }).parentListId).toBeNull();
  });

  it('enforces the one-level, same-subject sublist rules', async () => {
    const { subject } = await seedSubjectAndBooks();
    const other = (await post('/admin/subjects', { name: 'Science' })).json() as { id: string };
    const parent = (
      await post('/admin/lists', { title: 'Parent', subjectId: subject.id })
    ).json() as {
      id: string;
    };
    const child = (
      await post('/admin/lists', { title: 'Child', subjectId: subject.id })
    ).json() as {
      id: string;
    };
    const grandchild = (
      await post('/admin/lists', { title: 'Grandchild', subjectId: subject.id })
    ).json() as { id: string };

    const nest = (id: string, subjectId: string, parentListId: string | null) =>
      app.inject({
        method: 'PATCH',
        url: `${API}/admin/lists/${id}`,
        headers: auth,
        payload: { title: 't', subjectId, isPublished: false, parentListId },
      });

    // Child under Parent → ok.
    expect((await nest(child.id, subject.id, parent.id)).statusCode).toBe(200);
    // Grandchild under Child (a sublist) → one-level violation.
    expect((await nest(grandchild.id, subject.id, child.id)).statusCode).toBe(422);
    // A sublist whose subject differs from the parent → violation.
    expect((await nest(grandchild.id, other.id, parent.id)).statusCode).toBe(422);
  });

  it('sets series membership and order, reflected publicly', async () => {
    const { bookA, bookB, series } = await seedSubjectAndBooks();
    const res = await put(`/admin/series/${series.id}/books`, { bookIds: [bookB.id, bookA.id] });
    expect(res.statusCode).toBe(200);
    expect(
      (res.json() as { books: { seriesPosition: number }[] }).books.map((b) => b.seriesPosition),
    ).toEqual([1, 2]);
    const pub = await app.inject({ method: 'GET', url: `${API}/series/${series.slug}` });
    expect((pub.json() as { books: { slug: string }[] }).books).toHaveLength(2);
  });

  it('refuses to delete a parent list or a listed series (409)', async () => {
    const { subject, series } = await seedSubjectAndBooks();
    const parent = (
      await post('/admin/lists', { title: 'Parent', subjectId: subject.id })
    ).json() as {
      id: string;
    };
    const child = (
      await post('/admin/lists', { title: 'Child', subjectId: subject.id })
    ).json() as {
      id: string;
    };
    await app.inject({
      method: 'PATCH',
      url: `${API}/admin/lists/${child.id}`,
      headers: auth,
      payload: {
        title: 'Child',
        subjectId: subject.id,
        isPublished: false,
        parentListId: parent.id,
      },
    });
    // Parent has a sublist → delete blocked.
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `${API}/admin/lists/${parent.id}`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(409);

    // A series placed on a list → delete blocked.
    const list = (await post('/admin/lists', { title: 'L', subjectId: subject.id })).json() as {
      id: string;
    };
    await put(`/admin/lists/${list.id}/items`, { items: [{ seriesId: series.id }] });
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `${API}/admin/series/${series.id}`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(409);
  });
});
