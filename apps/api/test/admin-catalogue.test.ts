import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type {
  OpenLibraryClient,
  OpenLibraryDoc,
  OpenLibraryWork,
} from '../src/app/ports/open-library-client.js';
import type { ImageStore } from '../src/app/ports/image-store.js';
import { DrizzleUserRepository } from '../src/infra/db/drizzle-user-repository.js';
import { lists, listItems } from '../src/infra/db/schema/index.js';
import { testDb, resetStores, closeStores, buildTestServer } from './harness.js';

const API = '/api/v1';

// In-memory Open Library + cover store — no network, no filesystem.
class FakeOpenLibrary implements OpenLibraryClient {
  works = new Map<string, OpenLibraryWork>();
  docs: OpenLibraryDoc[] = [];
  search(): Promise<OpenLibraryDoc[]> {
    return Promise.resolve(this.docs);
  }
  fetchWork(workKey: string): Promise<OpenLibraryWork | null> {
    return Promise.resolve(this.works.get(workKey) ?? null);
  }
}
class FakeImageStore implements ImageStore {
  saveFromUrl(): Promise<string | null> {
    return Promise.resolve('cover.jpg');
  }
}

async function tokenFor(app: FastifyInstance, email: string, admin: boolean): Promise<string> {
  const payload = { email, password: 'correcthorsebattery', displayName: 'Ed' };
  await app.inject({ method: 'POST', url: `${API}/auth/register`, payload });
  if (admin) await new DrizzleUserRepository(testDb().db).promoteToAdmin(email);
  const login = await app.inject({
    method: 'POST',
    url: `${API}/auth/login`,
    payload: { email, password: 'correcthorsebattery' },
  });
  return (login.json() as { accessToken: string }).accessToken;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe('admin catalogue (integration)', () => {
  let app: FastifyInstance;
  let ol: FakeOpenLibrary;

  beforeEach(async () => {
    await resetStores();
    ol = new FakeOpenLibrary();
    app = buildTestServer({ openLibrary: ol, imageStore: new FakeImageStore() }).app;
    await app.ready();
  });
  afterAll(closeStores);

  it('gates every admin route behind the admin role', async () => {
    const anon = await app.inject({ method: 'GET', url: `${API}/admin/subjects` });
    expect(anon.statusCode).toBe(401);

    const memberToken = await tokenFor(app, 'member@example.com', false);
    const member = await app.inject({
      method: 'GET',
      url: `${API}/admin/subjects`,
      headers: auth(memberToken),
    });
    expect(member.statusCode).toBe(403);
  });

  it('does subject CRUD and rejects a duplicate name', async () => {
    const token = await tokenFor(app, 'admin@example.com', true);
    const create = await app.inject({
      method: 'POST',
      url: `${API}/admin/subjects`,
      headers: auth(token),
      payload: { name: 'History' },
    });
    expect(create.statusCode).toBe(201);
    const subject = create.json() as { id: string; slug: string };
    expect(subject.slug).toBe('history');

    const dup = await app.inject({
      method: 'POST',
      url: `${API}/admin/subjects`,
      headers: auth(token),
      payload: { name: 'History' },
    });
    expect(dup.statusCode).toBe(409);

    const update = await app.inject({
      method: 'PATCH',
      url: `${API}/admin/subjects/${subject.id}`,
      headers: auth(token),
      payload: { name: 'Modern History', description: 'The last 500 years.' },
    });
    expect((update.json() as { name: string }).name).toBe('Modern History');

    const del = await app.inject({
      method: 'DELETE',
      url: `${API}/admin/subjects/${subject.id}`,
      headers: auth(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it('reorders subjects and reflects the order publicly', async () => {
    const token = await tokenFor(app, 'admin@example.com', true);
    const mk = (name: string) =>
      app
        .inject({
          method: 'POST',
          url: `${API}/admin/subjects`,
          headers: auth(token),
          payload: { name },
        })
        .then((r) => (r.json() as { id: string }).id);
    const first = await mk('Alpha');
    const second = await mk('Beta');

    const reordered = await app.inject({
      method: 'PUT',
      url: `${API}/admin/subjects/reorder`,
      headers: auth(token),
      payload: { orderedIds: [second, first] },
    });
    expect(reordered.statusCode).toBe(200);
    expect((reordered.json() as { id: string }[]).map((s) => s.id)).toEqual([second, first]);
  });

  it('creates a book manually and dedupes on ISBN', async () => {
    const token = await tokenFor(app, 'admin@example.com', true);
    const subject = (
      await app.inject({
        method: 'POST',
        url: `${API}/admin/subjects`,
        headers: auth(token),
        payload: { name: 'Fiction' },
      })
    ).json() as { id: string };

    const create = await app.inject({
      method: 'POST',
      url: `${API}/admin/books`,
      headers: auth(token),
      payload: {
        title: 'Moby-Dick',
        authors: ['Herman Melville'],
        subjectIds: [subject.id],
        isbn13: '9780000000001',
        firstPublishedYear: 1851,
      },
    });
    expect(create.statusCode).toBe(201);
    const book = create.json() as { id: string; slug: string };
    expect(book.slug).toBe('moby-dick');

    // Same ISBN again → 409.
    const dup = await app.inject({
      method: 'POST',
      url: `${API}/admin/books`,
      headers: auth(token),
      payload: { title: 'Reprint', authors: [], subjectIds: [], isbn13: '9780000000001' },
    });
    expect(dup.statusCode).toBe(409);

    // Editable, and visible on the public book page.
    const detail = (
      await app.inject({
        method: 'GET',
        url: `${API}/admin/books/${book.id}`,
        headers: auth(token),
      })
    ).json() as { authors: { name: string }[]; subjectIds: string[] };
    expect(detail.authors[0]!.name).toBe('Herman Melville');
    expect(detail.subjectIds).toEqual([subject.id]);

    const pub = await app.inject({ method: 'GET', url: `${API}/books/moby-dick` });
    expect(pub.statusCode).toBe(200);
  });

  it('imports from Open Library and dedupes on the work key', async () => {
    const token = await tokenFor(app, 'admin@example.com', true);
    ol.works.set('OL1W', {
      workKey: 'OL1W',
      title: 'Frankenstein',
      description: 'A modern Prometheus.',
      authorNames: ['Mary Shelley'],
      firstPublishYear: 1818,
      coverId: 42,
      subjects: [],
    });

    const first = await app.inject({
      method: 'POST',
      url: `${API}/admin/books/import`,
      headers: auth(token),
      payload: { workKey: 'OL1W' },
    });
    expect(first.statusCode).toBe(201);
    expect((first.json() as { slug: string }).slug).toBe('frankenstein');

    // The imported book carries its cover and is publicly visible.
    const pub = (await app.inject({ method: 'GET', url: `${API}/books/frankenstein` })).json() as {
      coverUrl: string | null;
      authors: { name: string }[];
    };
    expect(pub.coverUrl).toBe('/covers/cover.jpg');
    expect(pub.authors[0]!.name).toBe('Mary Shelley');

    // Re-import the same work → 409 (dedupe on ol_work_key).
    const again = await app.inject({
      method: 'POST',
      url: `${API}/admin/books/import`,
      headers: auth(token),
      payload: { workKey: 'OL1W' },
    });
    expect(again.statusCode).toBe(409);
  });

  it('refuses to delete a book or subject still referenced by a list', async () => {
    const token = await tokenFor(app, 'admin@example.com', true);
    const { db } = testDb();
    const subject = (
      await app.inject({
        method: 'POST',
        url: `${API}/admin/subjects`,
        headers: auth(token),
        payload: { name: 'Fiction' },
      })
    ).json() as { id: string };
    const book = (
      await app.inject({
        method: 'POST',
        url: `${API}/admin/books`,
        headers: auth(token),
        payload: { title: 'Dracula', authors: ['Bram Stoker'], subjectIds: [subject.id] },
      })
    ).json() as { id: string };

    // Put the book on a list so both it and the subject are now referenced.
    const [list] = await db
      .insert(lists)
      .values({ title: 'Best Fiction', slug: 'best-fiction', subjectId: subject.id })
      .returning();
    await db.insert(listItems).values({ listId: list!.id, bookId: book.id, rank: 1 });

    const delBook = await app.inject({
      method: 'DELETE',
      url: `${API}/admin/books/${book.id}`,
      headers: auth(token),
    });
    expect(delBook.statusCode).toBe(409);

    const delSubject = await app.inject({
      method: 'DELETE',
      url: `${API}/admin/subjects/${subject.id}`,
      headers: auth(token),
    });
    expect(delSubject.statusCode).toBe(409);
  });
});
