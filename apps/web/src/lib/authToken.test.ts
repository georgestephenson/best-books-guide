import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, hasSessionHint, setAccessToken } from './authToken.js';

describe('authToken', () => {
  afterEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('holds the access token in memory', () => {
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('sets the session hint whenever a token is held, clears it when not', () => {
    setAccessToken('abc');
    expect(hasSessionHint()).toBe(true);
    expect(localStorage.getItem('bb_session')).toBe('1'); // durable across a reload

    setAccessToken(null);
    expect(hasSessionHint()).toBe(false);
    expect(localStorage.getItem('bb_session')).toBeNull();
  });

  it('falls back to attempting a refresh when localStorage reads throw', () => {
    setAccessToken('abc');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage blocked');
    });
    // Can't read the hint → assume a session might exist so restore still works.
    expect(hasSessionHint()).toBe(true);
  });

  it('swallows write failures so a blocked localStorage never breaks auth', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('localStorage blocked');
    });
    expect(() => setAccessToken('abc')).not.toThrow();
    expect(() => setAccessToken(null)).not.toThrow();
  });
});
