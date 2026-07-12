# ADR-0005 — JWT access tokens + rotating opaque refresh tokens in Redis

_Status: Accepted · 2026-07-11_

## Context
JWT auth is a fixed stack requirement. Naive JWT (long-lived token in localStorage) is a known 2026 anti-pattern (XSS-stealable, unrevocable). Alternatives considered: pure server-side sessions (simplest, but abandons the JWT requirement), BFF/token-handler (strongest per OAuth Security BCP RFC 9700, but heavy for one SPA + one API), and the standard hybrid.

## Decision
The 2026-standard SPA hybrid ([05 — Security](../05-security.md)): 15-minute HS256 access JWT held in JS memory; 256-bit opaque refresh token in an httpOnly `SameSite=Strict` cookie scoped to `/api/v1/auth`; server-side session records (hashed token, family id) in Redis; rotation on every refresh with **reuse detection** revoking the whole family; `sessidx` per user for logout-everywhere.

## Consequences
- Gets JWT's practice value and statelessness on the hot path (access-token verification hits no store), while staying revocable within 15 minutes — and immediately for refresh.
- Redis becomes auth-critical: if down, logins/refreshes fail closed but existing access tokens ride out ≤15 min; Monit auto-restart covers the gap. Accepted.
- HS256 (not RS256): single verifier today; switch to asymmetric only when a second service needs to verify tokens.
- More moving parts than cookie sessions — the cost of the JWT requirement, contained in one auth module + one ADR.
