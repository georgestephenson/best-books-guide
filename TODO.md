# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

**Status:** M1–M4 shipped — `bestbooks.guide` live, self-deploying from `main`. Now on **M5 — launch hardening**.

## Now — M5 launch hardening

Final pass before public announce. Full scope in [docs/08 §M5](docs/08-delivery-plan.md).

- [ ] **In review** — email-send resilience + auth-UI flag (`fix/email-send-resilience-and-auth-ui-flag`). A failed transactional send no longer 500s the request that triggered it ([ADR-0011](docs/adr/0011-best-effort-transactional-email.md)): SES sandbox rejections were breaking **live signup on prod** — the account row committed, then a 500, and the retry wedged on the existing-account path, which failed the same way from inside its own `catch`. Ships `VITE_AUTH_UI=false` in the prod build too, hiding the account entry points from anonymous visitors while the auth routes stay reachable by URL

- [ ] **In review** — dependency audit back to green (`claude/npm-audit-ci-fix-a42dta`). CI's `npm audit` gate was failing on 12 high advisories: patch bumps for `fast-uri`/`find-my-way`, React Router 7 → 8 (GHSA-qwww-vcr4-c8h2), ESLint 9 → 10 with `@eslint/js` 10 / react-hooks 7 / config-prettier 10 (clears the `minimatch` 3 → `brace-expansion` 1.x chain), and root `overrides` for `@fastify/static` (no fix reachable through `@fastify/swagger-ui`) and `test-exclude` (avoids a Vitest 4 major). Two new ESLint 10 recommended rules (`preserve-caught-error`, `no-useless-assignment`) fixed in place

- [ ] **In review** — unblock the stuck Dependabot PRs (`claude/dependabot-pr-fixes-uz56nl`). Both open bot PRs had been red since 2026-07-15. **#14 (`@vitejs/plugin-react` 5 → 6)** failed the build because plugin-react 6 dropped Babel and now imports `vite/internal` — it peers `vite@^8` and the repo was on Vite 7. Fixed by taking the enabling upgrade here: **Vite 7 → 8**, which forces **Vitest 3 → 4** (Vitest 3 caps at `vite@^7`) and `@vitest/coverage-v8` 3 → 4; that in turn clears the `test-exclude` override, since coverage-v8 4 dropped the dependency. Once this is on `main`, #14 rebases green. **#15 (`typescript` 5.9.3 → 7.0.2)** is *not* fixable here: no `typescript-eslint` release accepts TS ≥ 6.1 (8.65.0 and the 8.65.1 canary both peer `>=4.8.4 <6.1.0`), so `npm ci` can't resolve at all — see the note under Follow-ups
- [ ] Land **SES production access** — **denied, appeal open** (case ID in AWS Support Center; kept out of this public repo). Timeline: submitted 2026-07-21 21:27:39, auto-denied 2 seconds later with a boilerplate request for more detail; a use-case reply went in 2026-07-22 but never included the **sample email content** AWS asked for, and two content-free chasers (07-23, 07-24) re-queued it. Next: one complete reply covering all four of their questions (frequency, list maintenance, bounces/complaints/unsubscribes, **sample content** — all three templates incl. the existing-account notice), then leave it alone ≥3 business days. If nothing by ~2026-07-31, resolve the case and submit a fresh request with the full use-case text up front. Watch `aws sesv2 get-account --region eu-west-2` → `ProductionAccessEnabled` (not `ReviewDetails.Status`, which is a stale record of the 07-21 auto-deny). Case mail goes to the **root account address**, not the additional contact
- [ ] When production access lands: remove the `VITE_AUTH_UI` flag (delete `apps/web/src/lib/featureFlags.ts`, its three call sites, and the env in `.github/workflows/deploy.yml`), then tighten DMARC to `p=quarantine` after a clean sending month
- [ ] **Alert on email delivery failures** — [ADR-0011](docs/adr/0011-best-effort-transactional-email.md) makes a failed send silent to the user and loud only in the logs; nothing watches for a spike. Should land before the site takes real signup traffic
- [ ] Security pass: headers to Mozilla Observatory **A**, dependency audit clean, gitleaks clean, SG/ufw reviewed
- [ ] Restore drill (DB from S3 to scratch); host-rebuild drill against RTO; load sanity (`autocannon` on hot pages; p95 < 300 ms at modest concurrency)
- [ ] Content to launch bar (10+ subjects, ~100 books, blurbs written)
- [ ] 404/500 pages, favicon/OG images, privacy page (what's stored; deletion by email request until self-serve ships)
- [ ] Quiet **Support** page with a donate link (platform decision in "Later" below; no ads, ever)
- [ ] Seed the severe-terms list from a fuller maintained wordlist as content grows (currently a small curated seed)

## Follow-ups & carry-overs

- [ ] Consider a second email transport behind `EMAIL_TRANSPORT` (Resend/Postmark/Brevo — the `EmailSender` port makes it ~one file + DKIM/SPF records) **only if** the SES appeal is still unresolved past ~2 weeks. New external dependency ⇒ needs an ADR first
- [ ] Enable **CodeQL** (add `codeql.yml`) — from the M1 repo-settings checklist
- [ ] **TypeScript 7** (Dependabot #15) is blocked on `typescript-eslint`, which peers `typescript >=4.8.4 <6.1.0` as of 8.65.0 — with `engine-strict`/no `--legacy-peer-deps`, `npm ci` ERESOLVEs and every CI job dies at install. TS **6.0.3** *is* inside that range, so the available step is a 5.9 → 6.0 bump now and 7.x once typescript-eslint ships support. Decide whether to take TS 6 or hold; either way #15 as-is can't merge
- [ ] Drop the `@fastify/static` entry from root `overrides` once `@fastify/swagger-ui` widens to `^10` (docs/05 §Supply chain). The `test-exclude` override is gone — `@vitest/coverage-v8` 4 dropped the dependency outright
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
