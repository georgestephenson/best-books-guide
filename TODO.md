# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

**Status:** M1–M3 shipped — `bestbooks.guide` live, self-deploying from `main`. Now on **M4 — member features**: built, CI-green, and browser-verified locally on `claude/m4-member-features-4djeyg`; deploy pending.

## Now — M4 member features (deploy pending)

Built and verified end-to-end in Playwright (Chromium); not yet on prod. Full scope in [docs/08 §M4](docs/08-delivery-plan.md).

- [x] Migration 0002 — `reading_statuses`, `reviews`, `review_reports`, `tracked_lists` (docs/03)
- [x] F3 shelves — shelf upsert + grouped My Books; `finished_on` defaults to today
- [x] F4/F5 ratings & reviews — one per member per book (verified-email gate); `books.rating_avg/count` recomputed in the same transaction under a per-book row lock, so aggregates can't drift under concurrent writes (concurrency test proves it)
- [x] F5 language screen — `obscenity` matcher (leetspeak/Scunthorpe-aware): severe → auto-hide + system report, mild → publish + auto-report, clean → publish; severe wordlist base64-encoded, not plaintext (public repo)
- [x] F5/F6 moderation — member/auto reports → admin queue → hide/unhide/dismiss; author still sees their own hidden review, flagged
- [x] F7 track-a-list — track/untrack from list pages; member home + My Books show computed progress (series expanded, sublists rolled up; nothing stored)
- [x] Tests — 17 API integration + 6 language-screen unit + 11 web component; concurrency/no-drift test included
- [x] UI polish (2026-07-19) — mobile nav de-cluttered; username is a disclosure menu (Admin + Sign out); homepage/subject summaries roll up sublist items

**Design note:** member state lives on dedicated slug-addressed `/me/*` routes, not a `viewer` block in the public `GET /books|lists/{slug}` responses — keeps public pages anonymous + edge-cacheable. docs/04 updated to match.

**To ship:**

- [ ] Review/merge the M4 PR; deploy `main`; smoke the member journeys on `https://bestbooks.guide` (SES sandbox: verify from a verified inbox)
- [ ] Confirm exit criteria **on prod** (F1–F7 flows; aggregate no-drift; Playwright member happy-path)
- [ ] Seed the severe-terms list from a fuller maintained wordlist as content grows (currently a small curated seed)

## Follow-ups & carry-overs

- [ ] Submit the **SES production-access** request (lead time ~24h+; blocks M5) — until then, mail only reaches verified identities
- [ ] Enable **CodeQL** (add `codeql.yml`) — from the M1 repo-settings checklist
- [ ] Import the full SecLists top-10k into `apps/api/src/infra/security/breached-passwords.data.ts` (currently a curated seed)
- [ ] List/series reorder ships as up/down controls (docs/01 F6 says "drag" — deferred; up/down meets the ranking need)

## Later (scheduled reminders)

- [ ] Decide the M5 donation platform (Ko-fi to start; Patreon only if member-exclusive content emerges) and create the account
- [ ] Tighten DMARC to `p=quarantine` after a clean sending month
- [ ] Quarterly: backup restore drill (first one lands in M5)
- [ ] Oct 2026: Node 26 reaches LTS — bump nodesource role, CI, engines
- [ ] After 26.04.1 (≈Aug 2026): consider Ubuntu 26.04 LTS via host rebuild
- [ ] Once instance type settles: 1-yr Compute Savings Plan
- [ ] Pin third-party GitHub Actions to commit SHAs (Dependabot manages the bumps)
- [ ] Move Terraform `plan`/`apply` into CI (plan-on-PR, gated apply-on-`main`, scheduled drift `plan`) — currently apply is manual/local. Needs a broader OIDC role (create/destroy VPC/EC2/IAM) → **write an ADR** first; that's a real privilege escalation for CI

## Shipped

- [x] 2026-07-19 — **M3 catalogue & curation** — slices 1–6 merged; real lists on prod (3 subjects, 20 books, 5 lists); exit criteria confirmed on prod, Lighthouse (mobile) perf 97 / a11y 100
- [x] 2026-07-18 — **M2 accounts & auth** — full auth lifecycle on prod (register → verify → login → refresh w/ reuse detection + 10s grace window → logout → reset), `/me`, rate limits (429 + Retry-After), Argon2id, helmet CSP + nginx hardening; host converged (postgresql/redis/backup roles), migration 0001, CI PG18/Redis8 service containers; SPA auth. ADR-0009; docs/03/04/05/07 amended; 114 tests, ~94% coverage
- [x] 2026-07-15 — **M1 walking skeleton** — live, self-deploys from `main` in ~48s. Terraform + Ansible + CI/deploy/terraform workflows + Dependabot; Monit watchdog + SES alerts; rollback rehearsed both directions; UptimeRobot ping. ~11 bugs shaken out by live drills ([docs/08](docs/08-delivery-plan.md))
- [x] 2026-07-15 — Adopted **SSM** for host access (SSH tunnelled over SSM); closed port 22, dropped `admin_cidr`
- [x] 2026-07-12 — AWS account + `bootstrap`/`envs/prod` applied; repo settings (branch protection, Dependabot, squash-merge); internal identifiers kept as the short `bestbooks` slug
- [x] 2026-07-12 — **M1 app skeleton** — npm-workspaces monorepo, Fastify `/healthz` (clean-arch layering), React 19 + Vite 7 + Tailwind 4, TS strict, ESLint 9 + Prettier, Vitest + coverage gates, commitlint + husky, CI
- [x] 2026-07-12 — Registered **`bestbooks.guide`** (Route53); project → "Best Books Guide", repo → `best-books-guide`
- [x] 2026-07-11 — Region confirmed `eu-west-2` (London); design doc suite (01–08), ADRs 0001–0008, CLAUDE.md, TODO.md
