import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { API_BASE_PATH } from '@bestbooks/shared';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';
import { CataloguePage } from './CataloguePage.js';
import { ImportPage } from './ImportPage.js';
import { SubjectsPage } from './SubjectsPage.js';

const V1 = API_BASE_PATH;

// A restored session with the given role (AuthProvider refreshes on mount).
function session(role: 'member' | 'admin') {
  server.use(
    http.post(`${V1}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: 'tok',
        expiresIn: 900,
        user: {
          id: 'u1',
          email: 'ed@example.com',
          displayName: 'Ed',
          role,
          emailVerifiedAt: '2026-07-18T00:00:00Z',
        },
      }),
    ),
  );
}

describe('admin gate', () => {
  it('blocks a signed-in non-admin', async () => {
    session('member');
    server.use(http.get(`${V1}/admin/books`, () => HttpResponse.json([])));
    renderApp(<CataloguePage />);
    expect(await screen.findByText(/not authorised/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Catalogue' })).not.toBeInTheDocument();
  });
});

describe('CataloguePage', () => {
  it('lists books for an admin', async () => {
    session('admin');
    server.use(
      http.get(`${V1}/admin/books`, () =>
        HttpResponse.json([
          {
            id: 'b1',
            slug: 'moby-dick',
            title: 'Moby-Dick',
            authorNames: ['Herman Melville'],
            coverUrl: null,
          },
        ]),
      ),
    );
    renderApp(<CataloguePage />);
    expect(await screen.findByRole('heading', { name: 'Catalogue' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: /moby-dick/i });
    expect(link).toHaveAttribute('href', '/admin/books/b1');
  });
});

describe('ImportPage', () => {
  it('searches Open Library and imports a result', async () => {
    session('admin');
    server.use(
      http.get(`${V1}/admin/openlibrary/search`, () =>
        HttpResponse.json([
          {
            workKey: 'OL1W',
            title: 'Frankenstein',
            authorNames: ['Mary Shelley'],
            firstPublishYear: 1818,
            coverId: 1,
          },
        ]),
      ),
      http.post(`${V1}/admin/books/import`, () =>
        HttpResponse.json(
          { id: 'b9', slug: 'frankenstein', title: 'Frankenstein' },
          { status: 201 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp(<ImportPage />);

    await user.type(await screen.findByLabelText(/search open library/i), 'frankenstein');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Import' }));

    expect(await screen.findByRole('link', { name: /imported/i })).toHaveAttribute(
      'href',
      '/books/frankenstein',
    );
  });
});

describe('SubjectsPage', () => {
  it('adds a subject', async () => {
    session('admin');
    let created = false;
    server.use(
      http.get(`${V1}/admin/subjects`, () =>
        HttpResponse.json(
          created
            ? [{ id: 's1', slug: 'history', name: 'History', description: null, position: 0 }]
            : [],
        ),
      ),
      http.post(`${V1}/admin/subjects`, async () => {
        created = true;
        return HttpResponse.json(
          { id: 's1', slug: 'history', name: 'History', description: null, position: 0 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/admin/subjects" element={<SubjectsPage />} />
      </Routes>,
      { route: '/admin/subjects' },
    );

    await user.type(await screen.findByLabelText(/new subject name/i), 'History');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument());
  });
});
