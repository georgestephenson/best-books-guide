import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import { API_BASE_PATH, HEALTH_PATH } from '@bestbooks/shared';
import { App } from './App.js';
import { renderApp } from './test/render.js';
import { server } from './test/server.js';

describe('App (home)', () => {
  it('shows sign-in links and health when the session is anonymous', async () => {
    // Default handlers: healthy API, refresh 401 → anonymous.
    renderApp(<App />);
    expect(await screen.findByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(await screen.findByText(/api ok · test/i)).toBeInTheDocument();
  });

  it('greets a restored session', async () => {
    server.use(
      http.post(`${API_BASE_PATH}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: 'tok',
          expiresIn: 900,
          user: {
            id: 'u1',
            email: 'reader@example.com',
            displayName: 'Reader',
            role: 'member',
            emailVerifiedAt: '2026-07-18T00:00:00.000Z',
          },
        }),
      ),
    );
    renderApp(<App />);
    expect(await screen.findByText(/signed in as/i)).toHaveTextContent('Reader');
  });

  it('shows an error when the API health check fails', async () => {
    server.use(http.get(HEALTH_PATH, () => new HttpResponse(null, { status: 500 })));
    renderApp(<App />);
    expect(await screen.findByText(/api unreachable/i)).toBeInTheDocument();
  });
});
