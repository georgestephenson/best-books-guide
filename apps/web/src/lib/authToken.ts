/**
 * The access token lives in a module variable — memory only, never localStorage/
 * cookies (docs/05: an XSS-stealable token is the anti-pattern this design avoids).
 * A page reload wipes it; the session is restored by a refresh on boot.
 */
let accessToken: string | null = null;

/**
 * The session *hint* is the one thing we do persist: a bare boolean, no secret, so
 * it doesn't reopen the localStorage-token risk above. It's the durable shadow of
 * "do we hold an access token", written on every setAccessToken so it can't drift.
 * Boot reads it to decide whether a refresh is even worth attempting — an anonymous
 * visitor (the common case on a public, edge-cached site) then skips the pointless
 * POST /auth/refresh and its 401. The refresh cookie stays the authority; if the
 * hint is stale (e.g. the cookie expired server-side) the next refresh 401 clears it.
 */
const SESSION_HINT_KEY = 'bb_session';

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  setSessionHint(token !== null);
}

/** Whether a session might exist and a boot refresh is worth trying. */
export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    // localStorage unavailable (private mode, disabled) — fall back to attempting
    // the refresh so session restore still works; only the 401-avoidance is lost.
    return true;
  }
}

function setSessionHint(exists: boolean): void {
  try {
    if (exists) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Nothing we can do; refresh restore still works, just without the boot skip.
  }
}
