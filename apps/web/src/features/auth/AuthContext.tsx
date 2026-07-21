import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, LoginBody, PublicUser } from '@bestbooks/shared';
import { hasSessionHint, setAccessToken } from '../../lib/authToken.js';
import { refreshSession } from '../../lib/refresh.js';
import { loginRequest, logoutRequest, meRequest } from './api.js';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (credentials: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch the profile (e.g. after email verification flips the flag). */
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state as React context (docs/02 — context, add Zustand only if pain
 * appears). On mount it restores the session with a single-flight refresh + a
 * profile fetch, which is docs/01 F2's "session persistence across page reloads":
 * the access token is memory-only, so every load rotates the refresh cookie once.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const adopt = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    // No prior session on this device → skip the boot refresh (and its 401). The
    // hint is only a fast-path; a real session is still proven by the refresh below.
    if (!hasSessionHint()) {
      setStatus('anonymous');
      return;
    }
    let cancelled = false;
    void (async () => {
      const session = await refreshSession();
      if (cancelled) return;
      if (session) {
        adopt(session);
      } else {
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const login = useCallback(
    async (credentials: LoginBody) => {
      adopt(await loginRequest(credentials));
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const reloadUser = useCallback(async () => {
    setUser(await meRequest());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, reloadUser }),
    [status, user, login, logout, reloadUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
