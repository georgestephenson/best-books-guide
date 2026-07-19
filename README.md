# Best Books Guide 📚

[![CI](https://github.com/georgestephenson/best-books-guide/actions/workflows/ci.yml/badge.svg)](https://github.com/georgestephenson/best-books-guide/actions/workflows/ci.yml)
[![Deploy](https://github.com/georgestephenson/best-books-guide/actions/workflows/deploy.yml/badge.svg)](https://github.com/georgestephenson/best-books-guide/actions/workflows/deploy.yml)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fbestbooks.guide%2Fhealthz&up_message=live&down_message=down&label=bestbooks.guide)](https://bestbooks.guide/healthz)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

The best books in a simple list.

Modern technology has enabled a limitless supply of information. By stripping down to the highest quality, most authoritative books on different subjects, you can cancel out the noise and use your time more efficiently. Best Books Guide is designed to keep things _simple_ and keep you _sane_.

An interactive website allows users to track their reading journey.

## Note for (human) developers

This is primarily a learning exercise for practising [full stack development](https://roadmap.sh/full-stack).

My idea was to spin up a full stack project with the suggested tech stack, and then use this as my personal sandbox to study the whole stack.

**Stack**: React 19 · Tailwind 4 · Fastify 5 (Node 24, TypeScript) · PostgreSQL 18 · Redis 8 · Terraform + Ansible on AWS (EC2/VPC/S3/Route53/SES) · GitHub Actions · Monit.

**Deployment**: self-deploys from `main` to **[bestbooks.guide](https://bestbooks.guide/healthz)** over an SSM tunnel (no inbound SSH) — the badges above track CI, the last deploy, and whether the site is up. [Uptime](https://stats.uptimerobot.com/1mUEBA341u) · [roadmap](docs/08-delivery-plan.md).

## Documentation

- **Design docs**: [docs/](docs/README.md) — product, architecture, data model, API, security, infrastructure, operations, delivery plan
- **Decisions**: [docs/adr/](docs/adr/) — why each significant choice was made
- **Tasks**: [TODO.md](TODO.md) · **Working agreements**: [CLAUDE.md](CLAUDE.md) · **Conventions**: [CONTRIBUTING.md](CONTRIBUTING.md)

## Development

Prerequisites: **Node 24** (`nvm use` reads [.nvmrc](.nvmrc)) and npm 11. This is an npm-workspaces monorepo — `apps/api` (Fastify), `apps/web` (React/Vite), `packages/shared` (contract types).

```bash
npm install          # install all workspaces
npm run dev          # api on :3000 + web on :5173 (web proxies /api and /healthz to the api)
npm test             # Vitest across the monorepo, with coverage gates
npm run typecheck    # tsc project references + web typecheck
npm run lint         # ESLint 9 (flat config)
npm run build        # build shared → api → web
```

**Live and self-deploying**: the whole pipeline — Terraform → Ansible → CI/CD → Monit → HTTPS — runs itself, and `main` deploys to `bestbooks.guide` over an SSM tunnel with zero manual steps (`curl https://bestbooks.guide/healthz` → `{"status":"ok",...}`).

**Progress** (see the [delivery plan](docs/08-delivery-plan.md)):

- **M1 — walking skeleton** ✅ shipped
- **M2 — accounts & auth** ✅ shipped — register → email verification → login → refresh rotation (reuse detection) → reset; Argon2id, rate limits, hardened headers
- **M3 — catalogue & curation** ✅ shipped — curated subjects/lists/series/sublists with editor blurbs; admin CRUD + Open Library import; slug URLs, JSON-LD, sitemap
- **M4 — member features** 🛠️ built & browser-verified — reading shelves + My Books, star ratings & reviews (with transactional, drift-proof aggregates), an automated language screen + moderation queue, and track-a-list with computed progress. F1–F7 of the MVP; deploy pending.