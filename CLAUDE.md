# CLAUDE.md — working agreements for this repo

Best Books Guide: a curated, opinionated best-books-by-subject site. React 19/Vite/Tailwind 4 SPA + Fastify 5 (Node 24, TypeScript) + PostgreSQL 18 + Redis 8, on a single EC2 host via Terraform + Ansible, CI/CD via GitHub Actions, monitoring via Monit. Full design: [docs/](docs/README.md).

## Work process

1. **TODO.md is the canonical task list.** Read it at the start of every session; update it (move items, add follow-ups, date completed items) before ending one. Don't track work anywhere else.
2. **docs/ is the source of truth** for design. If a change invalidates a doc, update the doc in the same PR. If reality and docs disagree, flag it — don't silently pick one.
3. **Significant decisions get an ADR** in docs/adr/ (next number, format per ADR-0001). "Significant" = hard to reverse, contrarian, or likely to be questioned.
4. **Roadmap questions** → [docs/08-delivery-plan.md](docs/08-delivery-plan.md). Work the current milestone; resist pulling future features forward (backlog is pull-only).
5. **Ship vertical slices to prod.** Nothing sits unmerged; every milestone ends deployed.

## Conventions

- TypeScript strict everywhere; **npm workspaces** (canonical npm is deliberate — ADR-0002, don't suggest pnpm/yarn); Node 24 LTS.
- Commit messages per [CONTRIBUTING.md](CONTRIBUTING.md): Conventional Commits, standard types + monorepo scopes (`feat(api):`, `fix(ansible):` …); squash-merge, so PR titles must be valid subjects.
- Feature branches + PRs even solo; CI must be green; self-review means actually reading the diff.
- Tests ride with the code they test (Vitest); API integration tests use real PG/Redis (compose/service containers), not mocks of the database. Coverage gates + ratchet per [docs/02 §Testing strategy](docs/02-architecture.md) — a PR never lowers coverage, and CI must stay inside its speed budget.
- Never commit secrets; host/app secrets live in Ansible Vault, CI secrets in GitHub environments.

## Key context (check before assuming)

- **Domain**: `bestbooks.guide` — registered and DNS-hosted in Route53 (2026-07-12). GitHub repo: `best-books-guide`.
- **Region**: `eu-west-2` (confirmed) — a Terraform variable if it changes.
- Production is a **single EC2 host, no containers** (ADR-0006/0007) — don't introduce Docker/managed stores without revisiting those ADRs.
- **Host access is SSM-only** — no inbound SSH (port 22 closed). Reach the host by tunnelling SSH over SSM (`aws ssm start-session --target <instance-id>`); CI does the same via its OIDC role. Don't add an SSH ingress rule back.
- **The product is anti-noise by principle** ([docs/01 §Principles](docs/01-product.md)): run feature ideas through the noise test. Follows/feeds, review comments, tracking-based recommendations, and ads are philosophy-gated. Notifications, digests, badges, and streaks are allowed **only** opt-in + quiet + done well; recommendations come only from the curated catalogue (same author, co-listed, curation-graph similarity), never from reader tracking.
- Current phase: **M5 — launch hardening** (M1 walking skeleton, M2 accounts & auth, M3 catalogue & curation, and M4 member features all shipped to prod; `bestbooks.guide` live, self-deploying from `main`) — see [TODO.md](TODO.md).
  - **Member features (M4, shipped)**: shelves/reviews/tracked-lists live on dedicated slug-addressed `/me/*` routes, not as a `viewer` block in public catalogue responses (keeps public pages anonymous + edge-cacheable — docs/04). Review aggregates (`books.rating_avg/count`) are recomputed over visible reviews **in the same transaction as any review write, under a per-book `SELECT … FOR UPDATE`** — never add a trigger or a separate recompute path, and never let a write touch a review without the lock, or the count drifts under concurrency. The F5 language screen's severe wordlist is **base64-encoded** in `apps/api/src/infra/moderation/severe-terms.data.ts` (public repo — don't commit plaintext slurs).
