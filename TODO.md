# TODO

Canonical task list — see [CLAUDE.md](CLAUDE.md) for how this file is used. Roadmap detail lives in [docs/08-delivery-plan.md](docs/08-delivery-plan.md).

## Now

- [ ] Review the design doc suite (docs/) — amend anything that doesn't match intent, then commit
- [ ] Create/confirm the AWS account: enable MFA on root, create admin IAM identity, set AWS Budgets alarm (~$30)
- [ ] Point local git remote at the renamed repo: `git remote set-url origin https://github.com/georgestephenson/best-books-guide.git` (GitHub redirects the old URL, so not urgent)
- [ ] GitHub repo settings: branch protection on `main`, enable Dependabot + CodeQL, squash-merge only with PR title as default commit subject (per CONTRIBUTING.md)
- [ ] Decide whether to rename internal identifiers to match (`/srv/bestbooks` → `/srv/bestbooks-guide`, `bestbooks-api` service, local dir) or leave the short `bestbooks` slug — see note when scaffolding M1

## Next (M1 — walking skeleton)

- [ ] Scaffold npm-workspaces monorepo (apps/api `/healthz`, apps/web placeholder, packages/shared)
- [ ] Terraform bootstrap (state bucket w/ native locking, GitHub OIDC role, budget alarm), then envs/prod
  - ⚠️ Registering the domain in Route53 **auto-created a public hosted zone** for `bestbooks.guide`. The Terraform `dns` module must `terraform import` that existing zone (or reference its ID), not create a second one — two zones = split-brain NS. Confirm the zone's NS records still match the registered domain's after import.
- [ ] Ansible site.yml converges the host; deploy.yml ships a release
- [ ] GitHub Actions: ci / deploy (arm64 build) / terraform workflows
- [ ] Monit checks + SES SMTP alerts; external uptime ping (e.g. UptimeRobot free)
- [ ] Rehearse one rollback + one kill-the-process Monit drill (M1 exit criteria)

## Later (scheduled reminders)

- [ ] Request **SES production access** during M2 (lead time ~24h+, blocks M5)
- [ ] Decide the donation platform for M5's Support page (Ko-fi recommended to start; Patreon only if member-exclusive content emerges) and create the account
- [ ] Tighten DMARC to `p=quarantine` after a clean sending month
- [ ] Quarterly: backup restore drill (first one lands in M5)
- [ ] Oct 2026: Node 26 reaches LTS — bump nodesource role, CI, engines
- [ ] After 26.04.1 (≈Aug 2026): consider Ubuntu 26.04 LTS via host rebuild
- [ ] Once instance type settles: 1-yr Compute Savings Plan

## Done

- [x] 2026-07-12 — Registered **`bestbooks.guide`** directly in Route53; renamed project → "Best Books Guide", repo → `best-books-guide`; swept docs (domain + name)
- [x] 2026-07-11 — Region confirmed: `eu-west-2` (London)
- [x] 2026-07-11 — Design doc suite (docs/ 01–08), ADRs 0001–0008, CLAUDE.md, this file
