import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API_BASE_PATH, type SubjectDetail, type TrackedList } from '@bestbooks/shared';
import { App } from './App.js';
import { renderApp } from './test/render.js';
import { server } from './test/server.js';

/** Make the AuthProvider's mount-time refresh yield a signed-in session. */
function signedIn() {
  return http.post(`${API_BASE_PATH}/auth/refresh`, () =>
    HttpResponse.json({
      accessToken: 'tok',
      expiresIn: 900,
      user: {
        id: 'u1',
        email: 'reader@example.com',
        displayName: 'Ada',
        role: 'member',
        emailVerifiedAt: '2026-07-18T00:00:00.000Z',
      },
    }),
  );
}

/** The `z-<n>` utility an element carries, as a number (0 when it declares none). */
function layerOf(el: Element | null): number {
  const match = /(?:^|\s)z-(\d+)(?:\s|$)/.exec(el?.className ?? '');
  return match ? Number(match[1]) : 0;
}

const subjects: SubjectDetail[] = [
  {
    slug: 'fiction',
    name: 'Fiction',
    description: 'The novels that repay rereading.',
    lists: [
      {
        slug: 'best-fiction',
        title: 'The Essential Novels',
        intro: 'A short shelf.',
        itemCount: 12,
      },
    ],
  },
];

// Feature-flag stubs must never leak into the next test.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('App (catalogue home)', () => {
  it('renders subjects and their lists with a sign-in link', async () => {
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json(subjects)));
    renderApp(<App />);
    expect(
      await screen.findByRole('heading', { name: /what should you read next/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Fiction' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /the essential novels/i })).toHaveAttribute(
      'href',
      '/lists/best-fiction',
    );
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('answers the header sign-in with "coming soon" when the auth UI flag is off', async () => {
    vi.stubEnv('VITE_AUTH_UI', 'false');
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json(subjects)));
    renderApp(<App />);
    // The catalogue itself is unaffected — only the route to signup closes.
    expect(await screen.findByRole('link', { name: 'Fiction' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it('opens the "coming soon" note above the bookshelf overlay', async () => {
    vi.stubEnv('VITE_AUTH_UI', 'false');
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json(subjects)));
    const { container } = renderApp(<App />);
    await screen.findByRole('heading', { name: /what should you read next/i });

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    // jsdom paints nothing and loads no Tailwind, so compare the layers the two
    // elements declare: the shelf canvas overlays the page, the note overlays both.
    // At an equal z-index the canvas wins on DOM order and hides the note.
    const canvas = container.querySelector('[data-testid="bookshelf"]');
    expect(layerOf(canvas)).toBeGreaterThan(0);
    expect(layerOf(screen.getByRole('status'))).toBeGreaterThan(layerOf(canvas));
  });

  it('shows an empty state before any list is published', async () => {
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json([])));
    renderApp(<App />);
    expect(await screen.findByText(/first curated lists are being written/i)).toBeInTheDocument();
  });

  it('shows an error when the catalogue fails to load', async () => {
    server.use(
      http.get(`${API_BASE_PATH}/subjects`, () => new HttpResponse(null, { status: 500 })),
    );
    renderApp(<App />);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('opens on the decorative bookshelf for anonymous visitors', async () => {
    server.use(http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json(subjects)));
    const { container } = renderApp(<App />);
    await screen.findByRole('heading', { name: /what should you read next/i });
    // A decorative canvas scene — hidden from assistive tech, no tracked-lists block.
    expect(container.querySelector('[data-testid="bookshelf"]')).toBeInTheDocument();
    expect(screen.queryByText(/lists you track/i)).not.toBeInTheDocument();
  });

  it('shows the lists a signed-in reader tracks in the top slot', async () => {
    const tracked: TrackedList[] = [
      {
        slug: 'best-fiction',
        title: 'The Essential Novels',
        subject: { slug: 'fiction', name: 'Fiction' },
        progress: { total: 12, finished: 3, reading: 2, pctFinished: 25, pctReading: 17 },
      },
    ];
    server.use(
      signedIn(),
      http.get(`${API_BASE_PATH}/subjects`, () => HttpResponse.json(subjects)),
      http.get(`${API_BASE_PATH}/me/lists`, () => HttpResponse.json(tracked)),
    );
    renderApp(<App />);
    expect(await screen.findByText(/lists you track/i)).toBeInTheDocument();
    // The shelf yields the top slot to the tracked-lists block.
    await waitFor(() =>
      expect(document.querySelector('[data-testid="bookshelf"]')).not.toBeInTheDocument(),
    );
  });
});
