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

### Public catalogue
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/subjects` | — | Ordered subjects with published-list summaries |
| GET `/subjects/{slug}` | — | Subject + its published lists |
| GET `/lists/{slug}` | — | List + ranked items (book **or series** summary + blurb) + its sublists; with a token, `viewer.tracked` + progress; 404 if unpublished (non-admin) |
| GET `/books` | — | Paginated; `?search=` (trgm title/author), `?subject=` |
| GET `/books/{slug}` | — | Full book: authors, subjects, series, list appearances, aggregates, `related` strip (same author / co-listed) |
| GET `/series/{slug}` | — | Series + its books in `seriesPosition` order |
| GET `/books/{slug}/reviews` | — | Paginated, newest first, hidden filtered; includes caller's own review flagged if hidden |

`sitemap.xml` and `robots.txt` are served by the API at the root (Nginx-proxied) from published slugs.

### Member features
| Method & path | Auth | Purpose |
|---|---|---|
| GET `/me/shelf` | M | `?status=` filter; each item = book summary + status + dates |
| PUT `/me/shelf/{bookId}` | M | Upsert `{status, startedOn?, finishedOn?}` |
| DELETE `/me/shelf/{bookId}` | M | Remove from shelves |
| GET `/me/tracked-lists` | M | Tracked lists + computed progress `{totalBooks, finished, reading}` per list |
| PUT `/me/tracked-lists/{listId}` | M | Track a published list (idempotent) |
| DELETE `/me/tracked-lists/{listId}` | M | Untrack |
| PUT `/me/reviews/{bookId}` | MV | Upsert `{rating, body?}` — one per book; updates aggregates transactionally |
| DELETE `/me/reviews/{bookId}` | MV | Delete own review; updates aggregates |
| POST `/reviews/{reviewId}/reports` | MV | `{reason, note?}`; duplicate report → 409 |

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
| GET `/admin/reports?resolved=false` | Moderation queue |
| POST `/admin/reports/{id}/resolve` | `{action: "hide"|"dismiss", hiddenReason?}`; `dismiss` also **un-hides** a review the language screen auto-hid (false positive), so no valid review stays hidden after human review |

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
  "ratingCount": 128,
  "viewer": { "shelfStatus": "finished", "myRating": 5 }
}
```

`viewer` is present only with a valid access token — the same endpoint serves visitors and members; no duplicate routes.

## Rate limits (Redis-backed, per [05 — Security](05-security.md))

| Scope | Limit |
|---|---|
| `POST /auth/login` | 5 / 15 min per IP+email, then backoff |
| `POST /auth/register`, `/auth/forgot-password` | 3 / hour per IP |
| `POST /auth/refresh` | 60 / hour per session |
| Authenticated writes | 60 / min per user |
| Global anonymous | 300 / min per IP (headroom for real browsing) |

429 responses carry `Retry-After`. Limits are constants in `packages/shared` — one place to tune.
