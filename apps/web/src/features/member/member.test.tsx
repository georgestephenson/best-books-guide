import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import {
  API_BASE_PATH,
  type MyBooks,
  type Review,
  type TrackedList,
  type ViewerBook,
} from '@bestbooks/shared';
import { renderApp } from '../../test/render.js';
import { server } from '../../test/server.js';
import { BookMemberPanel } from './BookMemberPanel.js';
import { TrackButton } from './TrackButton.js';
import { MyBooksPage } from './MyBooksPage.js';
import { ModerationPage } from '../admin/ModerationPage.js';

const V1 = API_BASE_PATH;

/** Make the AuthProvider's mount-time refresh yield a signed-in session. */
function signedIn(overrides: Partial<{ role: 'member' | 'admin'; verified: boolean }> = {}) {
  const { role = 'member', verified = true } = overrides;
  return http.post(`${V1}/auth/refresh`, () =>
    HttpResponse.json({
      accessToken: 'tok',
      expiresIn: 900,
      user: {
        id: 'u1',
        email: 'reader@example.com',
        displayName: 'Ada',
        role,
        emailVerifiedAt: verified ? '2026-07-18T00:00:00.000Z' : null,
      },
    }),
  );
}

const emptyViewer: ViewerBook = { status: null, startedOn: null, finishedOn: null, review: null };

describe('BookMemberPanel', () => {
  it('prompts anonymous visitors to sign in and shows reviews', async () => {
    server.use(
      http.get(`${V1}/books/moby-dick/reviews`, () =>
        HttpResponse.json([
          {
            id: 'r1',
            rating: 5,
            body: 'A towering book.',
            displayName: 'Bob',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
          } satisfies Review,
        ]),
      ),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
    expect(await screen.findByText('A towering book.')).toBeInTheDocument();
  });

  it('lets a verified member shelve a book', async () => {
    let shelved: unknown = null;
    server.use(
      signedIn(),
      http.get(`${V1}/me/books/moby-dick`, () => HttpResponse.json(emptyViewer)),
      http.get(`${V1}/books/moby-dick/reviews`, () => HttpResponse.json([])),
      http.put(`${V1}/me/books/moby-dick/status`, async ({ request }) => {
        shelved = await request.json();
        return HttpResponse.json({ status: 'reading', startedOn: null, finishedOn: null });
      }),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    const readingBtn = await screen.findByRole('button', { name: 'Reading' });
    await userEvent.click(readingBtn);
    await waitFor(() => expect(shelved).toEqual({ status: 'reading' }));
  });

  it('lets a verified member post a rating', async () => {
    let posted: unknown = null;
    server.use(
      signedIn(),
      http.get(`${V1}/me/books/moby-dick`, () => HttpResponse.json(emptyViewer)),
      http.get(`${V1}/books/moby-dick/reviews`, () => HttpResponse.json([])),
      http.put(`${V1}/me/books/moby-dick/review`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          id: 'r9',
          rating: 4,
          body: null,
          isHidden: false,
          hiddenReason: null,
          createdAt: '2026-07-19T00:00:00.000Z',
          updatedAt: '2026-07-19T00:00:00.000Z',
        });
      }),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    await userEvent.click(await screen.findByRole('radio', { name: '4 stars' }));
    await userEvent.click(screen.getByRole('button', { name: /post review/i }));
    await waitFor(() => expect(posted).toEqual({ rating: 4, body: null }));
  });

  it('shows an existing review in read mode with edit/delete', async () => {
    server.use(
      signedIn(),
      http.get(`${V1}/me/books/moby-dick`, () =>
        HttpResponse.json({
          status: 'finished',
          startedOn: null,
          finishedOn: '2026-07-10',
          review: {
            id: 'mine',
            rating: 5,
            body: 'Rereads reward you.',
            isHidden: false,
            hiddenReason: null,
            createdAt: '2026-07-10T00:00:00.000Z',
            updatedAt: '2026-07-10T00:00:00.000Z',
          },
        } satisfies ViewerBook),
      ),
      http.get(`${V1}/books/moby-dick/reviews`, () => HttpResponse.json([])),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    // The member's own text renders, with Edit/Delete — not an empty editor.
    expect(await screen.findByText('Rereads reward you.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('flags the member’s own hidden review to them', async () => {
    server.use(
      signedIn(),
      http.get(`${V1}/me/books/moby-dick`, () =>
        HttpResponse.json({
          status: null,
          startedOn: null,
          finishedOn: null,
          review: {
            id: 'mine',
            rating: 1,
            body: 'nasty stuff',
            isHidden: true,
            hiddenReason: 'Automated language screen (pending review)',
            createdAt: '2026-07-10T00:00:00.000Z',
            updatedAt: '2026-07-10T00:00:00.000Z',
          },
        } satisfies ViewerBook),
      ),
      http.get(`${V1}/books/moby-dick/reviews`, () => HttpResponse.json([])),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    expect(await screen.findByText(/hidden by a moderator/i)).toBeInTheDocument();
  });

  it('nudges an unverified member to verify their email', async () => {
    server.use(
      signedIn({ verified: false }),
      http.get(`${V1}/me/books/moby-dick`, () => HttpResponse.json(emptyViewer)),
      http.get(`${V1}/books/moby-dick/reviews`, () => HttpResponse.json([])),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    expect(await screen.findByText(/verify your email to rate and review/i)).toBeInTheDocument();
  });

  it('lets a member report someone else’s review', async () => {
    let reported: unknown = null;
    server.use(
      signedIn(),
      http.get(`${V1}/me/books/moby-dick`, () => HttpResponse.json(emptyViewer)),
      http.get(`${V1}/books/moby-dick/reviews`, () =>
        HttpResponse.json([
          {
            id: 'r1',
            rating: 1,
            body: 'Spoiler: the whale wins.',
            displayName: 'Troll',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
          } satisfies Review,
        ]),
      ),
      http.post(`${V1}/reviews/r1/report`, async ({ request }) => {
        reported = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<BookMemberPanel slug="moby-dick" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Report' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /report reason/i }),
      'spoilers',
    );
    await userEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await waitFor(() => expect(reported).toEqual({ reason: 'spoilers' }));
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });
});

describe('TrackButton', () => {
  it('tracks a list and shows progress', async () => {
    let tracked = false;
    const list: TrackedList = {
      slug: 'best-history',
      title: 'Best History',
      subject: { slug: 'history', name: 'History' },
      progress: { total: 4, finished: 1, reading: 1, pctFinished: 25, pctReading: 25 },
    };
    server.use(
      signedIn(),
      http.get(`${V1}/me/lists/best-history/tracking`, () => HttpResponse.json({ tracked })),
      http.get(`${V1}/me/lists`, () => HttpResponse.json(tracked ? [list] : [])),
      http.put(`${V1}/me/lists/best-history`, () => {
        tracked = true;
        return HttpResponse.json({ tracked: true });
      }),
    );
    renderApp(<TrackButton slug="best-history" />);
    const btn = await screen.findByRole('button', { name: /track this list/i });
    await userEvent.click(btn);
    expect(await screen.findByRole('button', { name: /tracking/i })).toBeInTheDocument();
    expect(await screen.findByText('25% read')).toBeInTheDocument();
  });

  it('nudges anonymous visitors to sign in', async () => {
    renderApp(<TrackButton slug="best-history" />);
    expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
  });
});

describe('MyBooksPage', () => {
  it('renders tracked lists and the shelves', async () => {
    const myBooks: MyBooks = {
      want_to_read: [],
      reading: [],
      finished: [
        {
          status: 'finished',
          startedOn: null,
          finishedOn: '2026-07-10',
          updatedAt: '2026-07-10T00:00:00.000Z',
          book: {
            slug: 'moby-dick',
            title: 'Moby-Dick',
            subtitle: null,
            authors: [{ slug: 'herman-melville', name: 'Herman Melville' }],
            coverUrl: null,
            firstPublishedYear: 1851,
            ratingAvg: 4.6,
            ratingCount: 3,
          },
        },
      ],
    };
    server.use(
      signedIn(),
      http.get(`${V1}/me/books`, () => HttpResponse.json(myBooks)),
      http.get(`${V1}/me/lists`, () =>
        HttpResponse.json([
          {
            slug: 'best-history',
            title: 'Best History',
            subject: { slug: 'history', name: 'History' },
            progress: { total: 3, finished: 1, reading: 0, pctFinished: 33, pctReading: 0 },
          } satisfies TrackedList,
        ]),
      ),
    );
    renderApp(
      <Routes>
        <Route path="/my-books" element={<MyBooksPage />} />
      </Routes>,
      { route: '/my-books' },
    );
    expect(await screen.findByRole('heading', { name: 'My Books', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Best History')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Moby-Dick' })).toBeInTheDocument();
    expect(screen.getByText(/finished 2026-07-10/i)).toBeInTheDocument();
  });
});

describe('ModerationPage', () => {
  it('shows the report queue and hides a review', async () => {
    let hidden: unknown = null;
    let served = false;
    server.use(
      signedIn({ role: 'admin' }),
      http.get(`${V1}/admin/reviews/reports`, () => {
        if (served) return HttpResponse.json([]);
        served = true;
        return HttpResponse.json([
          {
            id: 'rep1',
            reason: 'language',
            note: 'Automated language screen — mild',
            reporterName: null,
            createdAt: '2026-07-18T00:00:00.000Z',
            review: {
              id: 'rev1',
              rating: 1,
              body: 'this is shit',
              isHidden: false,
              hiddenReason: null,
              authorName: 'Troll',
              bookTitle: 'Moby-Dick',
              bookSlug: 'moby-dick',
            },
          },
        ]);
      }),
      http.post(`${V1}/admin/reviews/rev1/hide`, async ({ request }) => {
        hidden = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(
      <Routes>
        <Route path="/admin/reviews" element={<ModerationPage />} />
      </Routes>,
      { route: '/admin/reviews' },
    );
    expect(await screen.findByText('this is shit')).toBeInTheDocument();
    // Reason badge — exact text distinguishes it from the "…language screen" note.
    expect(screen.getByText('language')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /hide review/i }));
    await waitFor(() => expect(hidden).not.toBeNull());
    expect(hidden).toHaveProperty('reason');
  });
});
