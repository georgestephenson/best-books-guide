import { afterEach, describe, expect, it, vi } from 'vitest';
import { authUiEnabled } from './featureFlags.js';

describe('authUiEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to enabled when the flag is unset (dev and test)', () => {
    expect(authUiEnabled()).toBe(true);
  });

  it('is disabled only by the exact string "false"', () => {
    vi.stubEnv('VITE_AUTH_UI', 'false');
    expect(authUiEnabled()).toBe(false);
  });

  it('stays enabled for any other value', () => {
    for (const value of ['true', 'off', '0', '']) {
      vi.stubEnv('VITE_AUTH_UI', value);
      expect(authUiEnabled()).toBe(true);
    }
  });
});
