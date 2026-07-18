// Auth lifetimes (docs/03, docs/05). One place so the use-cases and the Redis TTLs
// stay in agreement.

/** Access-token lifetime — 15 minutes (docs/05). Surfaced to the client as expiresIn. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh session absolute lifetime — 30 days from login, never extended. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Email-verification token — 24h. */
export const VERIFY_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/** Password-reset token — 1h. */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Grace window for a refresh token presented twice in quick succession ([ADR-0009]).
 * Within this window a stale-by-one token is treated as a benign double-fire
 * (boot refresh, React StrictMode, racing tabs) and re-rotated; beyond it, reuse
 * means theft and the session is revoked.
 */
export const REUSE_GRACE_MS = 10_000;

/**
 * A valid Argon2id hash of a throwaway value. Login verifies against this when the
 * email is unknown, so the response time doesn't reveal whether an account exists
 * (docs/05) — at m=19 MiB the timing delta would otherwise be obvious.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$EvgM+uwxcD1LHDaOt09D1Q$oyHqGSgOIiav15Crmq06+wcjz8BCdh6YimC88e/+rpo';
