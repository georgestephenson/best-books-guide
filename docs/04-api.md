# 04 — API design

_Last updated: 2026-07-12 · Status: Accepted_

REST over HTTPS, JSON bodies, same-origin (`/api/v1/*` behind Nginx). The contract types live in `packages/shared` and are consumed by both the Fastify schemas and the web client — one source of truth.

## Conventions

- **Base path**: `/api/v1`. Version bumps only for breaking changes; additive changes don't bump.
- **Naming**: plural nouns (`/books`, `/lists`); camelCase JSON fields; public resources addressed by **slug**, private/admin ones by **id**.
- **Methods**: GET (safe), PUT (idempotent upsert — used for shelf status and my-review), PATCH (partial update), POST (create/actions), DELETE.
- **Errors**: RFC 9457 `application/problem+json`, the current standard shape:

```json
{
  "type": "https://bestbooks.guide/errors/validation",
  "title": "Request body failed validation",
  "status": 422,
  "detail": "rating must be between 1 and 5",
  "errors": [{ "path": "/rating", "message": "must be >= 1" }],
  "requestId": "01981f2e-..."
}
```

  Status usage: 400 malformed, 401 unauthenticated (missing/expired token), 403 authenticated but forbidden, 404 not found (also used instead of 403 where existence itself is private), 409 conflict (duplicate slug, refresh-token reuse), 422 validation, 429 rate-limited (+ `Retry-After`).
- **Validation**: every route declares TypeBox request/response schemas. Responses are serialised from the schema — accidental field leakage (e.g. `password_hash`) is structurally impossible.
- **Pagination**: cursor-based — `?limit=20&cursor=<opaque>` → `{ "items": [...], "nextCursor": "..." | null }`. Cursors encode `(sortKey, id)`; stable under inserts. No offset pagination.
- **Auth transport**: `Authorization: Bearer <accessJWT>` on API calls; the refresh token rides an httpOnly cookie scoped to the refresh endpoint only ([05 — Security](05-security.md)).
- **IDs**: UUIDv7 strings. **Timestamps**: ISO-8601 UTC.
- **OpenAPI**: generated from the TypeBox schemas via `@fastify/swagger`; served at `/api/docs` in dev, behind admin auth in prod. The spec is a build artefact, never hand-edited.

## Endpoint catalogue

Auth column: `—` public · `M` member (valid access token) · `MV` member with verified email · `A` admin.

### Auth & account
| Method & path | Auth | Purpose |
|---|---|---|
| POST `/auth/register` | — | Create account; always 201-shaped response (no email enumeration); sends verification email |
| POST `/auth/verify-email` | — | Body `{token}`; single-use, 24h TTL |
| POST `/auth/resend-verification` | M | Rate-limited |
| POST `/auth/login` | — | Sets refresh cookie + returns `{accessToken, user}` |
| POST `/auth/refresh` | cookie | Rotates refresh token, returns new access token; reuse → 409 + session family revoked |
| POST `/auth/logout` | cookie | Revokes session, clears cookie |
| POST `/auth/forgot-password` | — | Always 202; sends reset email if account exists |
| POST `/auth/reset-password` | — | Body `{token, newPassword}`; revokes all sessions |
| GET `/me` | M | Profile + role + verification state |
| PATCH `/me` | M | Display name; email change is post-MVP |
| PUT `/me/password` | M | Requires current password; revokes other sessions |

Auth semantics (docs/05, [ADR-0009](adr/0009-refresh-reuse-grace-window.md)): **register** never auto-logs-in and is always 201-shaped (a duplicate emails the owner); **verify-email** returns `{verified:true}` and does not log in (the link often opens elsewhere); **login/refresh** return `{accessToken, expiresIn, user}` and set the refresh cookie, where `expiresIn` (900s) drives the SPA's silent-refresh timer; **refresh** returns **401** for a missing/expired session and **409** only for detected reuse; **logout** is **204** and idempotent; **reset-password** revokes all sessions, sets `email_verified_at` if unset (mailbox control just proven), and does not log in; **change-password** revokes every session and issues a fresh one, so the current device stays signed in while others are logged out.

### Public catalogue
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/subjects` | — | Ordered subjects with published-list summaries |
| GET `/subjects/{slug}` | — | Subject + its published lists |
| GET `/lists/{slug}` | — | List + ranked items (book **or series** summary + blurb) + its sublists; 404 if unpublished (non-admin) |
| GET `/books` | — | Paginated; `?search=` (trgm title/author), `?subject=` |
| GET `/books/{slug}` | — | Full book: authors, subjects, series, list appearances, aggregates, `related` strip (same author / co-listed) |
| GET `/series/{slug}` | — | Series + its books in `seriesPosition` order |
| GET `/books/{slug}/reviews` | — | Visible reviews, newest first (hidden filtered); anonymous. The caller's own review (incl. a hidden one, flagged) comes from `GET /me/books/{slug}` |

**Public responses stay member-agnostic.** Every public catalogue response is identical for visitors and members — no embedded `viewer` block. Member state is served from the dedicated `/me/*` routes below, addressed by the **same public slug**. This keeps public pages anonymous and edge-cacheable (docs/03 §Redis `cache:page:`); the SPA book/list pages fetch the public payload plus a small `/me/*` payload in parallel.

`sitemap.xml` and `robots.txt` are served by the API at the root (Nginx-proxied) from published slugs.

### Member features
All member resources are addressed by the same public **slug** as the catalogue (not an internal id). Shelving is `M`; writing a review is `MV` (verified email — docs/01 F2). Reporting is `M` (any member may flag; it isn't content creation).

| Method & path | Auth | Purpose |
|---|---|---|
| GET `/me/books` | M | My Books grouped by shelf (`want_to_read`/`reading`/`finished`); each item = book summary + shelf dates. The finished shelf is the reading log |
| GET `/me/books/{slug}` | M | The caller's shelf + own review (incl. `isHidden`/`hiddenReason`) for one book — drives the book page's member widgets |
| PUT `/me/books/{slug}/status` | M | Upsert `{status, startedOn?, finishedOn?}`; `finishedOn` defaults to today when marked finished, and is cleared on other shelves. Returns the resulting shelf |
| DELETE `/me/books/{slug}/status` | M | Remove from shelves (204) |
| PUT `/me/books/{slug}/review` | MV | Upsert `{rating, body?}` — one per book; runs the language screen (F5); recomputes aggregates in the same transaction. Returns the caller's review |
| DELETE `/me/books/{slug}/review` | M | Delete own review; recomputes aggregates (204) |
| POST `/reviews/{reviewId}/report` | M | `{reason, note?}`; duplicate → 409, unknown review → 404 (204 on success) |
| GET `/me/lists` | M | Tracked lists + computed progress `{total, finished, reading, pctFinished, pctReading}` per list |
| GET `/me/lists/{slug}/tracking` | M | `{tracked}` — drives the list page's Track button |
| PUT `/me/lists/{slug}` | M | Track a published list (idempotent) → `{tracked:true}`; 404 if not publicly visible |
| DELETE `/me/lists/{slug}` | M | Untrack → `{tracked:false}` |

### Admin (all `A`; mounted under `/admin`)
| Method & path | Purpose |
|---|---|
| GET `/admin/openlibrary/search?q=` | Server-side proxy to OL search (rate-limited, cached 10m) |
| POST `/admin/books/import` | `{olWorkKey}` → fetch metadata + cover, dedupe (409 with existing book on hit), create |
| POST/PATCH/DELETE `/admin/books[/{id}]` | Manual create / edit any field / delete (RESTRICTed while on lists) |
| POST/PATCH/DELETE `/admin/subjects[/{id}]` | Subject CRUD + reorder |
| POST/PATCH/DELETE `/admin/series[/{id}]` | Series CRUD; `PUT /admin/series/{id}/books` sets members + order |
| POST/PATCH/DELETE `/admin/lists[/{id}]` | List CRUD; `{isPublished}` toggle; `{parentListId}` nests a sublist |
| PUT `/admin/lists/{id}/items` | Replace full ranked item array `[{bookId \| seriesId, rank, blurb}]` — one transaction, deferred rank constraint |
| GET `/admin/reviews/reports` | Moderation queue — open reports (member + automated), oldest first, with review + book context |
| POST `/admin/reviews/{reviewId}/hide` | `{reason}`; soft-hides the review (author sees the reason), resolves that review's open reports, recomputes the book aggregate |
| POST `/admin/reviews/{reviewId}/unhide` | Reverse a hide (e.g. a false positive the language screen auto-hid) + recompute; no valid review stays hidden after human review |
| POST `/admin/reports/{reportId}/resolve` | Dismiss a single report **without** hiding — the review stays visible |

### Meta
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/healthz` | — | `{status:"ok", db:true, redis:true, version:"<git sha>"}`; used by Monit + deploy gate |

## Representative contract — `GET /books/{slug}` 200

```json
{
  "id": "01981f2e-7c1a-7bde-9e21-...",
  "slug": "the-making-of-the-atomic-bomb",
  "title": "The Making of the Atomic Bomb",
  "authors": [{ "name": "Richard Rhodes", "slug": "richard-rhodes" }],
  "description": "…editorial description…",
  "coverUrl": "/covers/01981f2e.jpg",
  "firstPublishedYear": 1986,
  "pageCount": 886,
  "subjects": [{ "name": "History", "slug": "history" }],
  "listAppearances": [{ "listTitle": "Best History Books", "listSlug": "best-history-books", "rank": 3 }],
  "series": null,
  "related": [
    { "slug": "dark-sun", "title": "Dark Sun", "coverUrl": "/covers/0198a1.jpg", "reason": "same-author" }
  ],
  "ratingAvg": 4.6,
  "ratingCount": 128
}
```

A signed-in reader's shelf and review for this book come from `GET /me/books/{slug}` (see Member features), fetched in parallel by the SPA.

## Rate limits (Redis-backed, per [05 — Security](05-security.md))

| Scope | Limit |
|---|---|
| `POST /auth/login` | 5 / 15 min per IP+email, then backoff |
| `POST /auth/register`, `/auth/forgot-password` | 3 / hour per IP |
| `POST /auth/refresh` | 60 / hour per session |
| Authenticated writes | 60 / min per user |
| Global anonymous | 300 / min per IP (headroom for real browsing) |

429 responses carry `Retry-After`. Limits are constants in `packages/shared` — one place to tune.
