# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

**M1–M3 shipped** — `bestbooks.guide` live, self-deploying from `main`; accounts & auth (M2) and curated catalogue (M3) on prod. Now on **M4 — member features**.

## Now (M4 — member features)

**BUILT and CI-green locally; verified end-to-end in a real browser (Playwright); not yet deployed.** On branch `claude/m4-member-features-4djeyg`. Full scope in [docs/08 §M4](docs/08-delivery-plan.md).

- [x] **Migration 0002** — `reading_statuses`, `reviews`, `review_reports`, `tracked_lists` (docs/03); CASCADE FKs, partial indexes (visible-review listing, open-report queue), `finished_on`-only-when-finished + rating 1–5 CHECKs. Drizzle-generated, no hand-augmentation needed.
- [x] **F3 shelves** — `PUT/DELETE /me/books/{slug}/status`, grouped `GET /me/books`; `finished_on` defaults to today. Optimistic UI on the book page; My Books page.
- [x] **F4/F5 ratings & reviews** — one per member per book (verified-email gate); `books.rating_avg/count` recomputed **in the same transaction under a per-book row lock** so aggregates can't drift under concurrent writes (test proves it).
- [x] **F5 language screen** — `obscenity` matcher (leetspeak/Scunthorpe-aware): severe → auto-hide + system report; mild → publish + auto-report; clean → publish. Severe wordlist base64-encoded, not plaintext (public repo). Machines flag, humans decide.
- [x] **F5/F6 moderation** — any member reports (dup → 409); admin queue (`GET /admin/reviews/reports`), hide (reason the author sees) / unhide / dismiss; author still sees their own hidden review flagged.
- [x] **F7 track-a-list** — track/untrack from list pages; member home + My Books show tracked lists with **computed** progress (series expanded, sublists rolled up; nothing stored).
- [x] Tests: 17 API integration + 6 language-screen unit + 11 web component; concurrency/no-drift test included. Playwright drove the full member happy-path (shelve → rate → review → track → progress → moderate) in Chromium — all green.

**Design note (flagged):** member state moved out of the public `GET /books|lists/{slug}` responses (the M2 doc sketch embedded a `viewer` block) into dedicated slug-addressed `/me/*` routes — keeps public pages anonymous + edge-cacheable and consistent with slug addressing. docs/04 updated to match.

**To finish shipping M4:**
- [ ] Review/merge the M4 PR; deploy `main`; smoke the member journeys on `https://bestbooks.guide` (SES sandbox: verify from a verified inbox)
- [ ] Confirm exit criteria **on prod** (F1–F7 flows; aggregate no-drift; Playwright member happy-path)
- [ ] Seed the severe-terms list from a fuller maintained wordlist as content grows (currently a small curated seed)

## Shipped earlier (M3 — catalogue & curation)

- [x] Slices 1–6 (catalogue foundation, public read API, public SPA, public-domain seed, admin CRUD + OL import, list/series builder) — merged; real lists live on prod (3 subjects, 20 books, 5 lists).
- [x] 2026-07-19 — Exit criteria confirmed **on prod**; Lighthouse (mobile) list + book pages: **perf 97, a11y 100** (nginx gzip + WCAG AA contrast/heading-order).
- [ ] Note: list/series reorder ships as up/down controls (docs/01 F6 says "drag" — deferred; up/down meets the ranking need)

## Carry-over / follow-ups (from M1–M2)

- [ ] Submit the **SES production-access** request (lead time ~24h+; blocks M5) — until then, mail only reaches verified identities
- [ ] Enable **CodeQL** (add `codeql.yml`) — carried over from the M1 repo-settings checklist
- [ ] Import the full SecLists top-10k into `apps/api/src/infra/security/breached-passwords.data.ts` (currently a curated seed)

## Later (scheduled reminders)

- [ ] Decide the donation platform for M5's Support page (Ko-fi recommended to start; Patreon only if member-exclusive content emerges) and create the account
- [ ] Tighten DMARC to `p=quarantine` after a clean sending month
- [ ] Quarterly: backup restore drill (first one lands in M5)
- [ ] Oct 2026: Node 26 reaches LTS — bump nodesource role, CI, engines
- [ ] After 26.04.1 (≈Aug 2026): consider Ubuntu 26.04 LTS via host rebuild
- [ ] Once instance type settles: 1-yr Compute Savings Plan
- [ ] Pin third-party GitHub Actions to commit SHAs (Dependabot manages the bumps)
- [ ] Move Terraform `plan`/`apply` into CI (plan-on-PR, gated apply-on-`main`, scheduled drift `plan`) — currently apply is manual/local. Needs a broader OIDC role (create/destroy VPC/EC2/IAM) → **write an ADR** first; that's a real privilege escalation for CI

## Done

- [x] 2026-07-18 — **M2 accounts & auth SHIPPED** 🚀 — host converged (postgresql/redis/backup roles), migration 0001 applied via the gated deploy, full auth lifecycle verified on `https://bestbooks.guide` (SES sandbox → verified inbox)
- [x] 2026-07-18 — **M2 accounts & auth BUILT** (on `feat/m2-host-data-stores`, CI-green locally, not yet deployed): `postgresql`/`redis`/`backup` Ansible roles + env/vault keys; Drizzle + migration 0001 (users, citext/pg_trgm) + advisory-locked `dist/migrate.js` + pre-migration `pg_dump` in deploy; CI PG18/Redis8 service containers + dev `docker-compose`; full auth lifecycle (register → verify → login → refresh w/ reuse detection + 10s grace window → logout → reset), `/me`, rate limits (429 + Retry-After), Argon2id, helmet CSP + nginx hardening, `@fastify/swagger`; SPA auth (React Router 7, in-memory token + single-flight silent refresh, register/login/verify/reset pages, auth context). ADR-0009; docs/03/04/05/07 amended. 114 tests, ~94% coverage
- [x] 2026-07-15 — **M1 walking skeleton SHIPPED** 🚀 — live at `bestbooks.guide/healthz`, self-deploys from `main` in ~48s with zero manual steps. Terraform (bootstrap + envs/prod) + Ansible (common/nodejs/nginx/app/monit) + deploy/terraform/CI workflows + Dependabot. Monit watchdog + SES alerts, rollback rehearsed both directions, UptimeRobot external ping. ~11 real bugs shaken out by live drills (catalogued in [docs/08](docs/08-delivery-plan.md))
- [x] 2026-07-15 — Adopted **SSM** for host access (SSH tunnelled over SSM, IAM-authorised); closed port 22 and dropped `admin_cidr`
- [x] 2026-07-12 — AWS account created; `bootstrap` + `envs/prod` applied; GitHub repo settings (branch protection, Dependabot, squash-merge) — *CodeQL still pending*
- [x] 2026-07-12 — Left internal identifiers as the short `bestbooks` slug (`/srv/bestbooks`, `bestbooks-api`) — rename not worth the churn
- [x] 2026-07-12 — **M1 app skeleton**: npm-workspaces monorepo (shared/api/web), Fastify `/healthz` with clean-arch layering, React 19 + Vite 7 + Tailwind 4 page via TanStack Query, TS strict, ESLint 9 + Prettier, Vitest + coverage gates, commitlint + husky, CI workflow
- [x] 2026-07-12 — Pointed local git remote at `best-books-guide`
- [x] 2026-07-12 — Registered **`bestbooks.guide`** in Route53; renamed project → "Best Books Guide", repo → `best-books-guide`
- [x] 2026-07-11 — Region confirmed: `eu-west-2` (London)
- [x] 2026-07-11 — Design doc suite (docs/ 01–08), ADRs 0001–0008, CLAUDE.md, this file
