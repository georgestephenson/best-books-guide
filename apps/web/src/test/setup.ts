import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server.js';
import { setAccessToken } from '../lib/authToken.js';

// MSW intercepts all fetches; an unhandled request is a test bug, so error on it.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// We don't enable Vitest globals, so Testing Library's automatic cleanup isn't
// registered — do it explicitly, and reset MSW + the in-memory token between tests.
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
});

afterAll(() => server.close());
