import type { AuthResponse } from '@bestbooks/shared';
import { API_BASE_PATH } from '@bestbooks/shared';
import { setAccessToken } from './authToken.js';

/**
 * Single-flight refresh (docs/05, [ADR-0009]). Every rotation of the refresh cookie
 * must happen exactly once even when several callers (boot restore, a 401 retry, two
 * components) ask at the same moment — so concurrent callers share one in-flight
 * request. This is the client half of the reuse-detection grace window: without it,
 * a StrictMode double-mount or racing tabs would fire two rotations and risk a 409.
 */
let inflight: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  inflight ??= doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<AuthResponse | null> {
  // Raw fetch, not the wrapped client — the client calls us on 401, so going
  // through it would recurse. `credentials: include` sends the refresh cookie.
  const res = await fetch(`${API_BASE_PATH}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = (await res.json()) as AuthResponse;
  setAccessToken(data.accessToken);
  return data;
}
