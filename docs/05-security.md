# 05 — Security

_Last updated: 2026-07-11 · Status: Accepted_

Scope: a public site with accounts, minimal PII (email + display name + reading activity), one admin. Design follows OWASP guidance current in 2026 (ASVS-informed, JWT BCP RFC 8725, OAuth Security BCP RFC 9700 where applicable).

## Authentication design ([ADR-0005](adr/0005-jwt-refresh-rotation.md))

The 2026-standard SPA pattern: **short-lived access JWT in memory + opaque rotating refresh token in an httpOnly cookie + server-side session records in Redis with reuse detection.**

| Token | Form | Lifetime | Lives | Notes |
|---|---|---|---|---|
| Access | JWT, HS256 via `@fastify/jwt` | 15 min | JS memory only (never storage) | Claims: `sub`, `role`, `sid`, `iss`, `aud`, `exp`, `iat`; `iss`/`aud` verified |
| Refresh | 256-bit random, opaque | 30 d absolute, rotated on every use | httpOnly cookie: `Secure; SameSite=Strict; Path=/api/v1/auth` | Only its SHA-256 hash is stored server-side |

```mermaid
sequenceDiagram
    participant B as Browser (SPA)
    participant A as API
    participant R as Redis
    B->>A: POST /auth/login (email, password)
    A->>A: verify Argon2id hash
    A->>R: create sess:{sid} {userId, tokenHash, family}
    A-->>B: Set-Cookie refresh (httpOnly) + accessToken (JSON)
    Note over B: access token kept in memory,<br/>attached as Bearer to API calls
    B->>A: POST /auth/refresh (cookie)
    A->>R: lookup sess:{sid}, compare hash
    alt hash matches (normal)
        A->>R: rotate: store new hash, keep family
        A-->>B: new cookie + new access token
    else hash is stale (reuse ⇒ theft signal)
        A->>R: revoke entire family (all sess of that login)
        A-->>B: 409 — full re-login required
    end
```

Decisions and rationale:
- **HS256, not RS256/EdDSA**: one service signs and verifies; asymmetric keys buy nothing until a second verifier exists. Secret is 256-bit, Ansible-Vault-managed, rotatable (dual-secret verify window).
- **Reuse detection**: a refresh token presented twice means it was stolen or the client double-fired; revoking the whole session family is the OWASP-recommended response.
- **Logout everywhere**: `sessidx:{userId}` lets password change / reset revoke all sessions.
- **Redis-down failure mode** (accepted): refresh and login fail closed; outstanding access tokens keep working ≤15 min. Monit restarts Redis well inside that window.
- **CSRF**: refresh cookie is `SameSite=Strict` + `Path`-scoped, and state-changing routes require the Bearer header (which a cross-site form can't set). The API additionally rejects cross-origin `Origin` headers. No CSRF token machinery needed.
- **Email flows**: verification (24h) and reset (1h) tokens are 256-bit random, stored **hashed** in Redis, single-use. Register/forgot endpoints return uniform responses (no account enumeration) and are rate-limited.

## Passwords

Argon2id via the `argon2` package with OWASP-recommended params (m=19 MiB, t=2, p=1 — revisit annually). Policy: length 10–128, checked against a top-10k breached list; no composition rules, no forced rotation (NIST-aligned). Login backoff via Redis counters.

## Authorization

Two roles enforced in the use-case layer (not just routes): `member` vs `admin`. Ownership checks (`my review`, `my shelf`) are part of the repository query (`WHERE user_id = $1`), so a missing check fails to "not found", never to another user's row. Verified email (`MV`) gates rating/review/report writes.

## Input & output safety

- Every request validated by TypeBox schema (types, ranges, lengths, `additionalProperties: false`).
- Responses serialised strictly from response schemas — unlisted fields (hashes, emails on public payloads) cannot leak.
- Review text is stored raw, rendered as text by React (no `dangerouslySetInnerHTML` anywhere; CSP as backstop). No user HTML/Markdown in MVP.
- Slugs generated server-side, `[a-z0-9-]` only.
- Open Library fetches: pinned to `openlibrary.org`/`covers.openlibrary.org` hosts, https only, 10s timeout, response size cap (5 MB covers), content-type checked, admin-triggered only — SSRF surface is a fixed allowlist.

## HTTP headers (`@fastify/helmet` + Nginx)

`Strict-Transport-Security: max-age=63072000; includeSubDomains` (preload after a settling period) · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` minimal · `frame-ancestors 'none'`.

CSP (SPA has no third-party scripts): `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. (`style-src 'unsafe-inline'` pending Tailwind-compatible tightening; tracked in backlog.)

## Platform & pipeline security

- **No long-lived AWS credentials anywhere**: GitHub Actions assumes an IAM role via **OIDC** (`id-token: write`), scoped to this repo + environment; the EC2 instance uses an instance role (S3 backup/media/release access + `ses:SendEmail`); IMDSv2 enforced. The single exception: one SMTP-only IAM user for Monit alerts ([06 — Infrastructure](06-infrastructure.md)).
- **Host**: SSH keys only (no passwords, no root login), SG restricts 22 to admin IP, unattended-upgrades on, fail2ban on sshd, ufw mirroring the SG, separate `bestbooks` service user, systemd unit hardening (`NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, writable paths whitelisted).
- **Supply chain**: Dependabot (npm, actions, terraform), `npm audit` in CI (fail on high), CodeQL (free on public repos), third-party GitHub Actions pinned to commit SHAs, `package-lock.json` committed and installs via `npm ci` only (lockfile-exact).
- **Secrets**: Ansible Vault (vault passphrase in GH Actions secret + local password manager) for host/app secrets; GitHub environment secrets for CI. `.env` files never committed; `gitleaks` pre-commit hook.
- **Transport/at rest**: TLS 1.2+ (Let's Encrypt, auto-renew), EBS + S3 encryption on, S3 buckets block all public access.

## OWASP Top 10 (2021/2025) quick map

| Risk | Main control here |
|---|---|
| Broken access control | Use-case-layer role checks; ownership in queries; verified-email gate |
| Cryptographic failures | Argon2id; hashed tokens at rest; TLS everywhere; no homemade crypto |
| Injection | Drizzle parameterised queries; TypeBox validation; React auto-escaping + CSP |
| Insecure design | This doc suite + ADRs; walking-skeleton pipeline before features |
| Security misconfiguration | Ansible = config as reviewed code; helmet defaults; SG/ufw minimal |
| Vulnerable components | Dependabot + audit gate + CodeQL; LTS-only runtimes |
| Auth failures | §Authentication above (rotation, reuse detection, rate limits, backoff) |
| Data integrity failures | Pinned actions (SHA), lockfile, signed AWS OIDC federation |
| Logging/monitoring failures | Pino + journald with request IDs; Monit alerting; auth events logged (no secrets/PII) |
| SSRF | OL host allowlist (only outbound fetch in the system) |

## Explicitly deferred (backlog)

BFF/token-handler pattern (RFC 9700's strongest SPA posture — overkill at this scale, revisit if auth surface grows) · 2FA/TOTP · CSP nonce tightening · WAF/CloudFront · account self-deletion & export UI (schema already cascades) · SIEM-grade audit trail (admin actions get structured logs from day one).
