# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

## Now

- [ ] Review the design doc suite (docs/) — amend anything that doesn't match intent, then commit
- [ ] Create/confirm the AWS account: enable MFA on root, create admin IAM identity, set AWS Budgets alarm (~$30)
- [ ] Open a PR for `feat/m1-walking-skeleton` and merge it (CI can't run until the workflow lands on `main`/PR)
- [ ] GitHub repo settings: branch protection on `main` (require the CI checks), enable Dependabot + CodeQL, squash-merge only with PR title as default commit subject (per CONTRIBUTING.md)
- [ ] Decide whether to rename internal identifiers to match (`/srv/bestbooks` → `/srv/bestbooks-guide`, `bestbooks-api` service, local dir) or leave the short `bestbooks` slug — see note when scaffolding M1

## Next (M1 — walking skeleton)

All infra-as-code is **written + statically verified** on `feat/m1-infra` (Terraform fmt/validate/tflint, Ansible ansible-lint/syntax-check, workflows actionlint). What remains is the **apply phase — needs the AWS account** — then the drills.

**AWS account + apply:**

- [ ] Create/confirm the AWS account (root MFA, admin IAM identity) — blocks everything below
- [ ] `terraform apply` bootstrap (local state) → note outputs
- [ ] `terraform apply` envs/prod → note EIP + SES SMTP creds
  - Route53 auto-created the zone at registration; the `dns` module uses a **data-source lookup** (not import), so no split-brain — just confirm the zone resolves.
- [ ] Set inventory `ansible_host` = EIP; create + encrypt `group_vars/all/vault.yml` (SES SMTP creds from TF output); set `admin_email`
- [ ] `ansible-playbook site.yml` → host converged + Let's Encrypt cert issued

**GitHub config (deploy workflow):**

- [ ] Repo **variables**: `AWS_ROLE_ARN` (bootstrap output `github_actions_role_arn`), `DEPLOY_HOST` (the EIP)
- [ ] Repo **secrets**: `SSH_PRIVATE_KEY` (matches the EC2 key pair), `ANSIBLE_VAULT_PASSWORD`
- [ ] Create the **`production`** environment with required reviewers (gates deploys)
- [ ] Branch protection on `main`: require CI checks; squash-merge only

**Exit-criteria drills:**

- [ ] Push to main → live at `https://bestbooks.guide/healthz` reporting the git SHA
- [ ] Rehearse one rollback (`deploy.yml -e release_sha=<prev>`); kill the API process, watch Monit restart + email
- [ ] External uptime ping (e.g. UptimeRobot free)

## Later (scheduled reminders)

- [ ] Request **SES production access** during M2 (lead time ~24h+, blocks M5)
- [ ] Decide the donation platform for M5's Support page (Ko-fi recommended to start; Patreon only if member-exclusive content emerges) and create the account
- [ ] Tighten DMARC to `p=quarantine` after a clean sending month
- [ ] Quarterly: backup restore drill (first one lands in M5)
- [ ] Oct 2026: Node 26 reaches LTS — bump nodesource role, CI, engines
- [ ] After 26.04.1 (≈Aug 2026): consider Ubuntu 26.04 LTS via host rebuild
- [ ] Once instance type settles: 1-yr Compute Savings Plan

## Done

- [x] 2026-07-12 — **M1 app skeleton** on `feat/m1-walking-skeleton`: npm-workspaces monorepo (shared/api/web), Fastify `/healthz` with clean-arch layering (domain→app→infra→http), React 19 + Vite 7 + Tailwind 4 page calling it via TanStack Query, TS strict, ESLint 9 + Prettier, Vitest + coverage gates (100% stmts / 96% branches), commitlint + husky, CI workflow. Verified locally: typecheck, lint, test, build, live `/healthz` all green
- [x] 2026-07-12 — Pointed local git remote at `best-books-guide`
- [x] 2026-07-12 — Registered **`bestbooks.guide`** directly in Route53; renamed project → "Best Books Guide", repo → `best-books-guide`; swept docs (domain + name)
- [x] 2026-07-11 — Region confirmed: `eu-west-2` (London)
- [x] 2026-07-11 — Design doc suite (docs/ 01–08), ADRs 0001–0008, CLAUDE.md, this file
