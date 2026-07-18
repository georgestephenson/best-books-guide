/**
 * The access token lives in a module variable — memory only, never localStorage/
 * cookies (docs/05: an XSS-stealable token is the anti-pattern this design avoids).
 * A page reload wipes it; the session is restored by a refresh on boot.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
