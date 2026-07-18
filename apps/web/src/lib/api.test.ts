import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { API_BASE_PATH } from '@bestbooks/shared';
import { server } from '../test/server.js';
import { ApiError, apiJson } from './api.js';
import { getAccessToken, setAccessToken } from './authToken.js';

describe('apiJson', () => {
  it('returns parsed JSON on success', async () => {
    server.use(http.get('/thing', () => HttpResponse.json({ ok: true })));
    await expect(apiJson('/thing')).resolves.toEqual({ ok: true });
  });

  it('returns undefined for 204', async () => {
    server.use(http.post('/thing', () => new HttpResponse(null, { status: 204 })));
    await expect(apiJson('/thing', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws ApiError carrying the problem + Retry-After on a 429', async () => {
    server.use(
      http.post('/thing', () =>
        HttpResponse.json(
          { type: 'x/rate-limited', title: 'Too many', status: 429, detail: 'slow down' },
          { status: 429, headers: { 'retry-after': '120' } },
        ),
      ),
    );
    await expect(apiJson('/thing', { method: 'POST' })).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 120,
    });
  });

  it('does NOT refresh on a 401 when there was no token (e.g. a login attempt)', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API_BASE_PATH}/auth/refresh`, () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
      http.post('/login', () => new HttpResponse(null, { status: 401 })),
    );
    await expect(apiJson('/login', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(0);
  });

  it('on a 401 with a token, silently refreshes and retries once', async () => {
    setAccessToken('expired-token');
    let attempt = 0;
    server.use(
      http.get('/me', ({ request }) => {
        const auth = request.headers.get('authorization');
        // First call carries the expired token → 401; after refresh, the fresh one → 200.
        if (auth === 'Bearer fresh-token') return HttpResponse.json({ id: 'u1' });
        attempt += 1;
        return new HttpResponse(null, { status: 401 });
      }),
      http.post(`${API_BASE_PATH}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: 'fresh-token',
          expiresIn: 900,
          user: {
            id: 'u1',
            email: 'a@b.co',
            displayName: 'A',
            role: 'member',
            emailVerifiedAt: null,
          },
        }),
      ),
    );

    await expect(apiJson('/me')).resolves.toEqual({ id: 'u1' });
    expect(attempt).toBe(1); // exactly one failed attempt before the retry
    expect(getAccessToken()).toBe('fresh-token'); // refresh updated the holder
  });
});
