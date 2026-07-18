# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

**M1 walking skeleton is shipped** (2026-07-15) — `bestbooks.guide/healthz` live, self-deploying from `main`. Now on **M2 — accounts & auth**.

## Now (M2 — ship it)

M2 is **built and CI-green on `feat/m2-host-data-stores`** (see Done). What's left is getting it onto prod:

- [ ] Populate the vault: `vault_db_password`, `vault_jwt_secret` (`ansible-vault create/edit group_vars/all/vault.yml`) — needed before both playbooks
- [ ] Converge the host from the branch: `ansible-playbook site.yml` (installs postgresql/redis/backup, renders the new `.env`) — the old app keeps serving; no schema yet
- [ ] Merge `feat/m2-host-data-stores` → `main` → approve the gated deploy (pre-migration `pg_dump` → `migrate.js` → app). **Order matters: `site.yml` before the merge**, or the new app boots with no DB and rolls back
- [ ] Verify the full auth lifecycle on `https://bestbooks.guide` (SES sandbox → your own verified inbox)
- [ ] Submit the **SES production-access** request (lead time ~24h+; blocks M5) — until then, mail only reaches verified identities
- [ ] Enable **CodeQL** (add `codeql.yml`) — carried over from the M1 repo-settings checklist
- [ ] Follow-up: import the full SecLists top-10k into `apps/api/src/infra/security/breached-passwords.data.ts` (currently a curated seed)

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
