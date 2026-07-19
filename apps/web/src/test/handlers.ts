import { http, HttpResponse } from 'msw';
import { API_BASE_PATH, HEALTH_PATH } from '@bestbooks/shared';

// Default handlers: a healthy API and an anonymous session (refresh 401s). Tests
// override per-case with `server.use(...)`.
export const handlers = [
  http.get(HEALTH_PATH, () =>
    HttpResponse.json({ status: 'ok', version: 'test', uptimeSeconds: 1, db: true, redis: true }),
  ),
  http.post(`${API_BASE_PATH}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
  // Book pages always load their public reviews (docs/01 F5) — default to none so any
  // BookPage render is self-contained; member tests override per-case.
  http.get(`${API_BASE_PATH}/books/:slug/reviews`, () => HttpResponse.json([])),
];
