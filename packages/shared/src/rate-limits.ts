/**
 * Rate-limit policy — the single place to tune it (docs/04 §Rate limits). Shared so
 * the API enforces it and the web client can surface sensible copy. Windows are in
 * seconds; the API keys each scope per docs/04 (login by IP+email, register/forgot
 * by IP, refresh by session).
 */
export interface RateLimitRule {
  /** Allowed attempts within the window before a 429. */
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 15 * 60 },
  register: { limit: 3, windowSeconds: 60 * 60 },
  forgotPassword: { limit: 3, windowSeconds: 60 * 60 },
  resendVerification: { limit: 3, windowSeconds: 60 * 60 },
  refresh: { limit: 60, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

/**
 * After the login limit trips, the lockout doubles on each further attempt up to a
 * cap — turning credential-stuffing into an exponentially expensive exercise
 * (docs/05 §Passwords "then backoff"). A successful login clears the counter.
 */
export const LOGIN_BACKOFF_MAX_SECONDS = 60 * 60;
