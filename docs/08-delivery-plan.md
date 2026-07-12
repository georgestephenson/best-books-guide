# 08 — Delivery plan

_Last updated: 2026-07-11 · Status: Accepted_

Strategy: **walking skeleton first** — the entire pipeline (Terraform → Ansible → CI/CD → Monit → HTTPS hello-world) ships before any feature. After that, every milestone is a vertical slice deployed to production the day it's done. Sizes are relative (S < M < L), not dates — this ships at the pace of available evenings.

**Definition of Done** (every story): typed + tested to the gates in [02 §Testing strategy](02-architecture.md) (≥90% on domain/use-cases, ≥80% overall, coverage ratchet — a PR never lowers it), passes CI inside its speed budget, deployed to prod, docs/ADR updated if behaviour or decisions changed, TODO.md updated.

## M0 — Foundations ✅ (2026-07-11)

Repo, licence, this design suite, ADRs 0001–0008, CLAUDE.md, TODO.md.

## M1 — Walking skeleton [M] ← next

The riskiest integrations, done while the app is trivial:

- Monorepo scaffold (npm workspaces, TS strict, ESLint 9 + Prettier, Vitest **with coverage gates wired from the first commit**, commitlint per CONTRIBUTING.md) — `apps/api` serving `/healthz`, `apps/web` placeholder page calling it, `packages/shared` with one shared type to prove the loop.
- Terraform: bootstrap (state bucket, OIDC role, budget alarm) then `envs/prod` (VPC, EC2, EIP, buckets, zone, SES identity).
- Domain purchased; DNS + Let's Encrypt live.
- Ansible `site.yml` converges the host end-to-end; `deploy.yml` ships releases.
- GitHub Actions: ci / deploy (arm64 build) / terraform workflows green; branch protection on.
- Monit checks + SES SMTP alert (to own inbox, sandbox is fine); external uptime ping.

**Exit criteria**: push to `main` → live at `https://<domain>/healthz` in <10 min with zero manual steps; one rollback rehearsed; one Monit alert received (kill the API process, watch it restart + email).

## M2 — Accounts & auth [M]

- Migrations 0001 (users + extensions); Drizzle wired; integration-test harness (PG/Redis service containers).
- Register → SES verification (own inboxes) → login → refresh rotation + reuse detection → logout → password reset. Rate limits + Argon2id + headers per [05](05-security.md).
- SPA: register/login/verify/reset pages, auth context, token-in-memory + silent refresh.
- **Request SES production access now** (lead time) — [TODO](../TODO.md).

**Exit criteria**: full auth lifecycle on prod; refresh-reuse revokes the family (tested); rate limits observable (429 + Retry-After).

## M3 — Catalogue & curation [L] *(grew from M in the 2026-07-11 product review: series, sublists, related books)*

- Migrations: books/authors/subjects/series/lists (incl. sublists)/list_items (+trgm indexes); admin role + promote runbook.
- Open Library search/import (covers → media dir), dedupe, manual create/edit fallback; manual series builder (create, attach/order books).
- Admin UI: catalogue CRUD, list builder with drag-rank + blurbs, sublist nesting, publish toggle.
- Public SPA: home (subjects), subject, list (with sublists), book (with related strip), series pages; slugs + React 19 metadata + JSON-LD; sitemap.xml/robots.txt from API.
- Seed 3 real lists (content work starts here and never stops).

**Exit criteria**: a visitor can browse real curated lists on prod; a series renders as one ranked list item with its own page; Lighthouse ≥ 90 perf/a11y on list + book pages.

## M4 — Member features [M]

- Migrations: reading_statuses, reviews, review_reports, tracked_lists; aggregate maintenance.
- Shelf upsert + My Books; ratings + reviews (verified-email gate); report → admin queue → hide.
- Track-a-list (F7): track/untrack from list pages; member home shows tracked lists with computed progress (% read · % reading; series expanded, sublists rolled up).
- Automated language screen on review submit (maintained wordlist matcher, e.g. `obscenity`): severe → auto-hide + system report; mild → auto-report into the same queue ([01](01-product.md) F5, [03](03-data-model.md) §review_reports).
- Optimistic UI for shelf/rating via TanStack Query.

**Exit criteria**: MVP feature set F1–F7 complete on prod; aggregates never drift under concurrent review writes (test exists); Playwright journeys cover the member happy path end-to-end.

## M5 — Launch hardening [S] → 🚀

- SES production access confirmed; DMARC tightened after clean sending.
- Security pass: headers verified (Mozilla Observatory A), dependency audit clean, gitleaks clean, SG/ufw reviewed.
- Restore drill (DB from S3 to scratch), host-rebuild drill against RTO, load sanity (`autocannon` on hot pages; p95 < 300 ms at modest concurrency).
- Content to launch bar (10+ subjects, ~100 books, blurbs written).
- 404/500 pages, favicon/OG images, privacy page (what's stored; deletion by email request until self-serve ships).
- Quiet **Support** page with a donate link (platform decision tracked in TODO.md; no ads, ever — [01](01-product.md) Principle 4).

**Exit criteria**: [01 — Product](01-product.md) launch definition met. Announce.

## Post-MVP backlog (ordered; pull, don't push)

1. SSR/SEO upgrade (RR7 framework mode) — trigger: organic search matters ([ADR-0008](adr/0008-spa-first-ssr-ready.md))
2. Cross-list similarity for the related-books strip (curation graph: shared subjects/co-listing — never reader tracking)
3. Staging environment (TF module re-use) — trigger: deploys start feeling risky
4. Page/percent reading progress (F-cut from MVP)
5. Opt-in notifications & digests; quiet badges/streaks — only clearing the "done well" bar in [01 — Product](01-product.md) §Principles
6. Search upgrade (PG websearch/tsvector before any search engine)
7. Account self-deletion + export
8. LLM-assisted review moderation (upgrade of M4's wordlist screen)
9. Public member profiles (a shareable shelf page — only if members ask; follows/comments remain **philosophy-gated**, see [01 — Product](01-product.md) §Non-goals)
10. Community list suggestions
11. Patreon-style memberships (the donate link itself ships in M5)
12. CloudFront + S3 media origin; Savings Plan; RDS/ElastiCache if ops toil says so
13. 2FA; BFF token-handler pattern if auth surface grows

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| SES production-access delay blocks launch | Request in M2, weeks early; sandbox covers all dev/testing |
| Solo-dev blind spots | CI gates + CodeQL + self-review ritual + ADR discipline; docs enable a second brain to onboard fast |
| Engagement features drifting into noise | The opt-in + quiet + "done well" bar in [01](01-product.md) §Principles; tracking-based mechanics stay philosophy-gated (principles rewrite + ADR required); backlog stays pull-only |
| MVP scope growth | Series, sublists, and related books landed in M3 (2026-07-11 review) and it resized M→L — that review is the line; further additions wait for post-MVP |
| Single-host outage | Monit auto-restart; tested 2h rebuild; accepted trade-off recorded in [06](06-infrastructure.md) |
| Open Library data quality | Everything editable post-import; manual-entry fallback |
| Cover image rights | OL covers used as OL serves them; attribution page; editorial can swap any cover |
| Node 24 → 26 LTS transition (Oct 2026) | Additive: bump nodesource role + CI matrix when 26 is LTS; tracked in TODO |
