# ADR-0002 — Single GitHub repo, npm workspaces monorepo

_Status: Accepted · 2026-07-11 (package manager revised same day)_

## Context
Web SPA, API, shared contract types, Terraform, Ansible, and docs all serve one product built by one person. Repo shape: polyrepo vs monorepo. Workspace tooling: **npm workspaces** (canonical, bundled with Node since npm 7), **pnpm** (fastest installs, strict `node_modules`), or yarn. pnpm was the first draft's pick on general 2026 merit, but a stated project goal is practising *canonical npm* (e.g. the workshopper **how-to-npm** course) — and at this scale pnpm's speed/strictness advantages are marginal.

## Decision
One repository, **npm workspaces** (npm 11, bundled with Node 24): `apps/web`, `apps/api`, `packages/shared`, plus `infra/` and `docs/`.

## Consequences
- Atomic changes: an API contract change updates server, client, and shared types in one reviewed PR; `packages/shared` makes client/server type drift a compile error.
- One CI setup; path filters (`apps/**` vs `infra/**`) keep workflows scoped; installs are `npm ci` (lockfile-exact) with the standard setup-node cache.
- Zero extra toolchain: the package manager is the one every Node tutorial, CI image, and runbook assumes — and the one being studied.
- Accepted trade-offs vs pnpm: slower installs (cache mitigates) and hoisting permits **phantom dependencies** (importing a package a workspace never declared). Mitigation: a `knip`/`depcheck` check added in M1's CI, plus review discipline.
- Cheap to reverse: `pnpm import` generates its lockfile from `package-lock.json` if this decision is ever revisited.
