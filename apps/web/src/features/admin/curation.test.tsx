import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { API_BASE_PATH } from '@bestbooks/shared';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';
import { ListsPage } from './ListsPage.js';
import { ListBuilderPage } from './ListBuilderPage.js';
import { SeriesListPage } from './SeriesListPage.js';
import { SeriesBuilderPage } from './SeriesBuilderPage.js';

const V1 = API_BASE_PATH;

function adminSession() {
  server.use(
    http.post(`${V1}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: 'tok',
        expiresIn: 900,
        user: {
          id: 'u1',
          email: 'ed@x.io',
          displayName: 'Ed',
          role: 'admin',
          emailVerifiedAt: '2026-01-01T00:00:00Z',
        },
      }),
    ),
  );
}

const subjects = [{ id: 'sub1', slug: 'fiction', name: 'Fiction', description: null, position: 0 }];
const books = [
  { id: 'bk1', slug: 'moby-dick', title: 'Moby-Dick', authorNames: [], coverUrl: null },
  { id: 'bk2', slug: 'frankenstein', title: 'Frankenstein', authorNames: [], coverUrl: null },
];

describe('ListsPage', () => {
  it('lists existing lists', async () => {
    adminSession();
    server.use(
      http.get(`${V1}/admin/lists`, () =>
        HttpResponse.json([
          {
            id: 'l1',
            slug: 'best-fiction',
            title: 'Best Fiction',
            subjectName: 'Fiction',
            parentTitle: null,
            isPublished: true,
            itemCount: 3,
          },
        ]),
      ),
      http.get(`${V1}/admin/subjects`, () => HttpResponse.json(subjects)),
    );
    renderApp(<ListsPage />);
    expect(await screen.findByRole('link', { name: /best fiction/i })).toHaveAttribute(
      'href',
      '/admin/lists/l1',
    );
    expect(screen.getByText('Published')).toBeInTheDocument();
  });
});

describe('ListBuilderPage', () => {
  it('loads a list, adds a book item, and saves items + details', async () => {
    adminSession();
    let itemsBody: unknown = null;
    const listDetail = {
      id: 'l1',
      slug: 'best-fiction',
      title: 'Best Fiction',
      subjectId: 'sub1',
      parentListId: null,
      intro: null,
      isPublished: false,
      items: [{ type: 'book', refId: 'bk1', title: 'Moby-Dick', rank: 1, blurb: null }],
    };
    server.use(
      http.get(`${V1}/admin/lists/l1`, () => HttpResponse.json(listDetail)),
      http.get(`${V1}/admin/lists`, () => HttpResponse.json([])),
      http.get(`${V1}/admin/subjects`, () => HttpResponse.json(subjects)),
      http.get(`${V1}/admin/books`, () => HttpResponse.json(books)),
      http.get(`${V1}/admin/series`, () => HttpResponse.json([])),
      http.patch(`${V1}/admin/lists/l1`, () => HttpResponse.json(listDetail)),
      http.put(`${V1}/admin/lists/l1/items`, async ({ request }) => {
        itemsBody = await request.json();
        return HttpResponse.json(listDetail);
      }),
    );
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/admin/lists/:id" element={<ListBuilderPage />} />
      </Routes>,
      { route: '/admin/lists/l1' },
    );

    // Existing item shown in the items list (scoped — the picker also lists titles).
    const itemsList = await screen.findByRole('list');
    expect(within(itemsList).getByText('Moby-Dick')).toBeInTheDocument();
    // Add Frankenstein as a second item.
    await user.selectOptions(screen.getByLabelText(/add item/i), 'book:bk2');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(within(screen.getByRole('list')).getByText('Frankenstein')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save list/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
    expect(itemsBody).toEqual({
      items: [
        { bookId: 'bk1', blurb: null },
        { bookId: 'bk2', blurb: null },
      ],
    });
  });
});

describe('SeriesBuilderPage', () => {
  it('adds a book to the series and saves the order', async () => {
    adminSession();
    let booksBody: unknown = null;
    const detail = {
      id: 'se1',
      slug: 'holmes',
      title: 'Sherlock Holmes',
      description: null,
      books: [],
    };
    server.use(
      http.get(`${V1}/admin/series/se1`, () => HttpResponse.json(detail)),
      http.get(`${V1}/admin/books`, () => HttpResponse.json(books)),
      http.patch(`${V1}/admin/series/se1`, () => HttpResponse.json(detail)),
      http.put(`${V1}/admin/series/se1/books`, async ({ request }) => {
        booksBody = await request.json();
        return HttpResponse.json(detail);
      }),
    );
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/admin/series/:id" element={<SeriesBuilderPage />} />
      </Routes>,
      { route: '/admin/series/se1' },
    );

    await user.selectOptions(await screen.findByLabelText(/add book/i), 'bk1');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: /save series/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
    expect(booksBody).toEqual({ bookIds: ['bk1'] });
  });
});

describe('ListsPage create', () => {
  it('creates a list from the form', async () => {
    adminSession();
    let body: unknown = null;
    server.use(
      http.get(`${V1}/admin/lists`, () => HttpResponse.json([])),
      http.get(`${V1}/admin/subjects`, () => HttpResponse.json(subjects)),
      http.post(`${V1}/admin/lists`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'l9', slug: 'new' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp(<ListsPage />);
    await user.type(await screen.findByLabelText(/new list title/i), 'New');
    await user.selectOptions(screen.getByLabelText('Subject'), 'sub1');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(body).toEqual({ title: 'New', subjectId: 'sub1' }));
  });
});

describe('SeriesListPage', () => {
  it('renders series and creates one', async () => {
    adminSession();
    let body: unknown = null;
    server.use(
      http.get(`${V1}/admin/series`, () =>
        HttpResponse.json([{ id: 'se1', slug: 'holmes', title: 'Sherlock Holmes', bookCount: 4 }]),
      ),
      http.post(`${V1}/admin/series`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'se9', slug: 'new' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp(<SeriesListPage />);
    expect(await screen.findByRole('link', { name: /sherlock holmes/i })).toHaveAttribute(
      'href',
      '/admin/series/se1',
    );
    await user.type(screen.getByLabelText(/new series title/i), 'New');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(body).toEqual({ title: 'New' }));
  });
});

describe('ListBuilderPage edit operations', () => {
  it('reorders, edits a blurb, removes an item, and deletes the list', async () => {
    adminSession();
    let deleted = false;
    const listDetail = {
      id: 'l1',
      slug: 'best-fiction',
      title: 'Best Fiction',
      subjectId: 'sub1',
      parentListId: null,
      intro: null,
      isPublished: false,
      items: [
        { type: 'book', refId: 'bk1', title: 'Moby-Dick', rank: 1, blurb: null },
        { type: 'book', refId: 'bk2', title: 'Frankenstein', rank: 2, blurb: null },
      ],
    };
    server.use(
      http.get(`${V1}/admin/lists/l1`, () => HttpResponse.json(listDetail)),
      http.get(`${V1}/admin/lists`, () => HttpResponse.json([])),
      http.get(`${V1}/admin/subjects`, () => HttpResponse.json(subjects)),
      http.get(`${V1}/admin/books`, () => HttpResponse.json(books)),
      http.get(`${V1}/admin/series`, () => HttpResponse.json([])),
      http.delete(`${V1}/admin/lists/l1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/admin/lists/:id" element={<ListBuilderPage />} />
        <Route path="/admin/lists" element={<div>lists index</div>} />
      </Routes>,
      { route: '/admin/lists/l1' },
    );

    const list = await screen.findByRole('list');
    expect(within(list).getByText('Moby-Dick')).toBeInTheDocument();
    // Edit the first item's blurb.
    await user.type(screen.getAllByPlaceholderText(/why it's here/i)[0]!, 'note');
    // Reorder: move the first item down.
    await user.click(within(list).getAllByRole('button', { name: 'Move down' })[0]!);
    // Remove an item.
    await user.click(
      within(screen.getByRole('list')).getAllByRole('button', { name: 'Remove' })[0]!,
    );
    // Delete the list.
    await user.click(screen.getByRole('button', { name: /delete list/i }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});

describe('SeriesBuilderPage edit operations', () => {
  it('reorders, removes a book, and deletes the series', async () => {
    adminSession();
    let deleted = false;
    const detail = {
      id: 'se1',
      slug: 'holmes',
      title: 'Sherlock Holmes',
      description: null,
      books: [
        { id: 'bk1', title: 'Moby-Dick', seriesPosition: 1 },
        { id: 'bk2', title: 'Frankenstein', seriesPosition: 2 },
      ],
    };
    server.use(
      http.get(`${V1}/admin/series/se1`, () => HttpResponse.json(detail)),
      http.get(`${V1}/admin/books`, () => HttpResponse.json(books)),
      http.delete(`${V1}/admin/series/se1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/admin/series/:id" element={<SeriesBuilderPage />} />
        <Route path="/admin/series" element={<div>series index</div>} />
      </Routes>,
      { route: '/admin/series/se1' },
    );

    const list = await screen.findByRole('list');
    expect(within(list).getByText('Moby-Dick')).toBeInTheDocument();
    await user.click(within(list).getAllByRole('button', { name: 'Move down' })[0]!);
    await user.click(
      within(screen.getByRole('list')).getAllByRole('button', { name: 'Remove' })[0]!,
    );
    await user.click(screen.getByRole('button', { name: /delete series/i }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
