# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

**Status:** M1–M4 shipped — `bestbooks.guide` live, self-deploying from `main`. Now on **M5 — launch hardening**.

## Now — M5 launch hardening

Final pass before public announce. Full scope in [docs/08 §M5](docs/08-delivery-plan.md).

- [ ] Land **SES production access** (submit the request tracked in carry-overs below, then confirm — blocks emailing arbitrary addresses); tighten DMARC to `p=quarantine` after a clean sending month
- [ ] Security pass: headers to Mozilla Observatory **A**, dependency audit clean, gitleaks clean, SG/ufw reviewed
- [ ] Restore drill (DB from S3 to scratch); host-rebuild drill against RTO; load sanity (`autocannon` on hot pages; p95 < 300 ms at modest concurrency)
- [ ] Content to launch bar (10+ subjects, ~100 books, blurbs written)
- [ ] 404/500 pages, favicon/OG images, privacy page (what's stored; deletion by email request until self-serve ships)
- [ ] Quiet **Support** page with a donate link (platform decision in "Later" below; no ads, ever)
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

- [x] 2026-07-19 — **M4 member features** — merged (#27 + follow-ups) and deployed to prod; `bestbooks.guide` serving member journeys. Migration 0002 (`reading_statuses`, `reviews`, `review_reports`, `tracked_lists`); F3 shelves (upsert + grouped My Books); F4/F5 ratings & reviews (verified-email gate, one per member per book) with `books.rating_avg/count` recomputed in the same transaction under a per-book row lock (concurrency/no-drift test); F5 language screen (`obscenity`, leetspeak/Scunthorpe-aware; severe wordlist base64-encoded); F5/F6 moderation (member/auto reports → admin queue → hide/unhide/dismiss); F7 track-a-list with computed progress (series expanded, sublists rolled up, nothing stored). Member state on dedicated slug-addressed `/me/*` routes (public pages stay anonymous + edge-cacheable). 17 API integration + 6 language-screen unit + 11 web component tests; Playwright member happy-path (Chromium). Exit criteria confirmed on prod
- [x] 2026-07-19 — **M3 catalogue & curation** — slices 1–6 merged; real lists on prod (3 subjects, 20 books, 5 lists); exit criteria confirmed on prod, Lighthouse (mobile) perf 97 / a11y 100
- [x] 2026-07-18 — **M2 accounts & auth** — full auth lifecycle on prod (register → verify → login → refresh w/ reuse detection + 10s grace window → logout → reset), `/me`, rate limits (429 + Retry-After), Argon2id, helmet CSP + nginx hardening; host converged (postgresql/redis/backup roles), migration 0001, CI PG18/Redis8 service containers; SPA auth. ADR-0009; docs/03/04/05/07 amended; 114 tests, ~94% coverage
- [x] 2026-07-15 — **M1 walking skeleton** — live, self-deploys from `main` in ~48s. Terraform + Ansible + CI/deploy/terraform workflows + Dependabot; Monit watchdog + SES alerts; rollback rehearsed both directions; UptimeRobot ping. ~11 bugs shaken out by live drills ([docs/08](docs/08-delivery-plan.md))
- [x] 2026-07-15 — Adopted **SSM** for host access (SSH tunnelled over SSM); closed port 22, dropped `admin_cidr`
- [x] 2026-07-12 — AWS account + `bootstrap`/`envs/prod` applied; repo settings (branch protection, Dependabot, squash-merge); internal identifiers kept as the short `bestbooks` slug
- [x] 2026-07-12 — **M1 app skeleton** — npm-workspaces monorepo, Fastify `/healthz` (clean-arch layering), React 19 + Vite 7 + Tailwind 4, TS strict, ESLint 9 + Prettier, Vitest + coverage gates, commitlint + husky, CI
- [x] 2026-07-12 — Registered **`bestbooks.guide`** (Route53); project → "Best Books Guide", repo → `best-books-guide`
- [x] 2026-07-11 — Region confirmed `eu-west-2` (London); design doc suite (01–08), ADRs 0001–0008, CLAUDE.md, TODO.md
