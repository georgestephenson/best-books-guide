import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// We don't enable Vitest globals, so Testing Library's automatic cleanup isn't
// registered — do it explicitly so the DOM is reset between tests.
afterEach(() => {
  cleanup();
});
