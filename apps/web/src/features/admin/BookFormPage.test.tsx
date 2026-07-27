import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { API_BASE_PATH } from '@bestbooks/shared';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';
import { BookFormPage } from './BookFormPage.js';

const V1 = API_BASE_PATH;

function adminSession() {
  server.use(
    http.post(`${V1}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: 'tok',
        expiresIn: 900,
        user: {
          id: 'u1',
          email: 'ed@example.com',
          displayName: 'Ed',
          role: 'admin',
          emailVerifiedAt: '2026-07-18T00:00:00Z',
        },
      }),
    ),
  );
}

const subjects = [
  { id: 's1', name: 'History', slug: 'history', description: null, position: 1 },
  { id: 's2', name: 'Science', slug: 'science', description: null, position: 2 },
];

function withSubjects() {
  server.use(http.get(`${V1}/admin/subjects`, () => HttpResponse.json(subjects)));
}

/** Mount at /admin/books/:id so `useParams` reports the editing id. */
function renderEditing(id: string) {
  return renderApp(
    <Routes>
      <Route path="/admin/books/:id" element={<BookFormPage />} />
      <Route path="/admin" element={<h1>Admin home</h1>} />
    </Routes>,
    { route: `/admin/books/${id}` },
  );
}

function renderCreating() {
  return renderApp(
    <Routes>
      <Route path="/admin/books/new" element={<BookFormPage />} />
      <Route path="/admin" element={<h1>Admin home</h1>} />
    </Routes>,
    { route: '/admin/books/new' },
  );
}

describe('BookFormPage — create', () => {
  it('posts a trimmed, split-authors body and returns to the admin home', async () => {
    adminSession();
    withSubjects();
    let sent: unknown;
    server.use(
      http.post(`${V1}/admin/books`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: 'b1', slug: 'sapiens' }, { status: 201 });
      }),
    );
    renderCreating();

    expect(await screen.findByRole('heading', { name: 'New book' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), '  Sapiens  ');
    await user.type(screen.getByLabelText(/Authors/), ' Yuval Noah Harari , ');
    await user.type(screen.getByLabelText('Year'), '2011');
    await user.click(screen.getByRole('button', { name: 'Create book' }));

    expect(await screen.findByRole('heading', { name: 'Admin home' })).toBeInTheDocument();
    expect(sent).toMatchObject({
      title: 'Sapiens',
      authors: ['Yuval Noah Harari'],
      firstPublishedYear: 2011,
      // blank optional fields collapse to null, language falls back to 'en'
      subtitle: null,
      pageCount: null,
      isbn13: null,
      language: 'en',
    });
  });

  it('rejects a blank title without calling the API', async () => {
    adminSession();
    withSubjects();
    server.use(
      http.post(`${V1}/admin/books`, () => {
        throw new Error('must not be called');
      }),
    );
    renderCreating();

    await screen.findByRole('heading', { name: 'New book' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create book' }));

    expect(await screen.findByText('A title is required.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin home' })).not.toBeInTheDocument();
  });

  it('surfaces the problem detail when the save fails', async () => {
    adminSession();
    withSubjects();
    server.use(
      http.post(`${V1}/admin/books`, () =>
        HttpResponse.json(
          { status: 409, title: 'Conflict', detail: 'That ISBN already exists.' },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderCreating();

    await screen.findByRole('heading', { name: 'New book' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'Sapiens');
    await user.click(screen.getByRole('button', { name: 'Create book' }));

    expect(await screen.findByText('That ISBN already exists.')).toBeInTheDocument();
  });

  it('has no Delete button when creating', async () => {
    adminSession();
    withSubjects();
    renderCreating();

    await screen.findByRole('heading', { name: 'New book' });
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

describe('BookFormPage — edit', () => {
  const existing = {
    id: 'b1',
    slug: 'sapiens',
    title: 'Sapiens',
    subtitle: 'A Brief History of Humankind',
    authors: [{ id: 'a1', name: 'Yuval Noah Harari' }],
    description: 'Big history.',
    firstPublishedYear: 2011,
    pageCount: 443,
    isbn13: '9780099590088',
    language: 'en',
    subjectIds: ['s1'],
    coverUrl: null,
  };

  it('prefills the form from the loaded book', async () => {
    adminSession();
    withSubjects();
    server.use(http.get(`${V1}/admin/books/b1`, () => HttpResponse.json(existing)));
    renderEditing('b1');

    expect(await screen.findByRole('heading', { name: 'Edit book' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Sapiens'));
    expect(screen.getByLabelText(/Authors/)).toHaveValue('Yuval Noah Harari');
    expect(screen.getByLabelText('Year')).toHaveValue('2011');
    expect(screen.getByLabelText('Pages')).toHaveValue('443');
    expect(screen.getByLabelText('ISBN-13')).toHaveValue('9780099590088');
    // the book's subject is ticked, the other is not
    expect(screen.getByRole('checkbox', { name: 'History' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Science' })).not.toBeChecked();
  });

  it('coerces null optional fields to empty inputs', async () => {
    adminSession();
    withSubjects();
    server.use(
      http.get(`${V1}/admin/books/b2`, () =>
        HttpResponse.json({
          ...existing,
          id: 'b2',
          subtitle: null,
          description: null,
          firstPublishedYear: null,
          pageCount: null,
          isbn13: null,
          subjectIds: [],
        }),
      ),
    );
    renderEditing('b2');

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Sapiens'));
    expect(screen.getByLabelText('Subtitle')).toHaveValue('');
    expect(screen.getByLabelText('Year')).toHaveValue('');
    expect(screen.getByLabelText('Pages')).toHaveValue('');
    expect(screen.getByLabelText('ISBN-13')).toHaveValue('');
  });

  it('PATCHes changes and toggles subject checkboxes both ways', async () => {
    adminSession();
    withSubjects();
    let sent: unknown;
    server.use(
      http.get(`${V1}/admin/books/b1`, () => HttpResponse.json(existing)),
      http.patch(`${V1}/admin/books/b1`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(existing);
      }),
    );
    renderEditing('b1');

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Sapiens'));
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'History' })); // untick
    await user.click(screen.getByRole('checkbox', { name: 'Science' })); // tick
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: 'Admin home' })).toBeInTheDocument();
    expect(sent).toMatchObject({ title: 'Sapiens', subjectIds: ['s2'] });
  });

  it('deletes and returns to the admin home', async () => {
    adminSession();
    withSubjects();
    let deleted = false;
    server.use(
      http.get(`${V1}/admin/books/b1`, () => HttpResponse.json(existing)),
      http.delete(`${V1}/admin/books/b1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderEditing('b1');

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Sapiens'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: 'Admin home' })).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it('surfaces a failed delete', async () => {
    adminSession();
    withSubjects();
    server.use(
      http.get(`${V1}/admin/books/b1`, () => HttpResponse.json(existing)),
      http.delete(`${V1}/admin/books/b1`, () =>
        HttpResponse.json(
          { status: 409, title: 'Conflict', detail: 'Book is on a list.' },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderEditing('b1');

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Sapiens'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Book is on a list.')).toBeInTheDocument();
  });
});
