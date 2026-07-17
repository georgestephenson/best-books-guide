# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

**M1 walking skeleton is shipped** (2026-07-15) — `bestbooks.guide/healthz` live, self-deploying from `main`. Now on **M2 — accounts & auth**.

## Now (M2 kickoff)

Auth needs the datastores the walking skeleton skipped, so the deferred Ansible roles come first:

- [ ] Ansible `postgresql` role (PG 18 via PGDG, tuned for the 2 GB host, `pg_trgm`/`citext`, app DB + role) + a Monit process check; converge with `site.yml`
- [ ] Ansible `redis` role (Redis 8, localhost-only, `maxmemory` + LRU) + Monit check
- [ ] Ansible `backup` role (nightly `pg_dump`→S3, media sync, heartbeats) — once PG exists
- [ ] Add `DATABASE_URL` / `REDIS_URL` / `JWT_SECRET` to the vault + the app `.env` template (extend `config.ts` validation)
- [ ] CI `test` job: PG + Redis service containers so integration tests run against real stores
- [ ] Request **SES production access** early (lead time ~24h+; blocks M5) — until then, alert/verify recipients must be verified identities
- [ ] Enable **CodeQL** (add `codeql.yml`) — carried over from the M1 repo-settings checklist

## Next (M2 — accounts & auth · detail in [docs/08](docs/08-delivery-plan.md))

- [ ] Migrations 0001 (users + extensions); Drizzle wired; integration-test harness
- [ ] Auth flows: register → SES verify → login → refresh rotation + reuse detection → logout → password reset (rate limits, Argon2id, security headers per [docs/05](docs/05-security.md))
- [ ] SPA: register / login / verify / reset pages; auth context; access token in memory + silent refresh

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

- [x] 2026-07-15 — **M1 walking skeleton SHIPPED** 🚀 — live at `bestbooks.guide/healthz`, self-deploys from `main` in ~48s with zero manual steps. Terraform (bootstrap + envs/prod) + Ansible (common/nodejs/nginx/app/monit) + deploy/terraform/CI workflows + Dependabot. Monit watchdog + SES alerts, rollback rehearsed both directions, UptimeRobot external ping. ~11 real bugs shaken out by live drills (catalogued in [docs/08](docs/08-delivery-plan.md))
- [x] 2026-07-15 — Adopted **SSM** for host access (SSH tunnelled over SSM, IAM-authorised); closed port 22 and dropped `admin_cidr`
- [x] 2026-07-12 — AWS account created; `bootstrap` + `envs/prod` applied; GitHub repo settings (branch protection, Dependabot, squash-merge) — *CodeQL still pending*
- [x] 2026-07-12 — Left internal identifiers as the short `bestbooks` slug (`/srv/bestbooks`, `bestbooks-api`) — rename not worth the churn
- [x] 2026-07-12 — **M1 app skeleton**: npm-workspaces monorepo (shared/api/web), Fastify `/healthz` with clean-arch layering, React 19 + Vite 7 + Tailwind 4 page via TanStack Query, TS strict, ESLint 9 + Prettier, Vitest + coverage gates, commitlint + husky, CI workflow
- [x] 2026-07-12 — Pointed local git remote at `best-books-guide`
- [x] 2026-07-12 — Registered **`bestbooks.guide`** in Route53; renamed project → "Best Books Guide", repo → `best-books-guide`
- [x] 2026-07-11 — Region confirmed: `eu-west-2` (London)
- [x] 2026-07-11 — Design doc suite (docs/ 01–08), ADRs 0001–0008, CLAUDE.md, this file
