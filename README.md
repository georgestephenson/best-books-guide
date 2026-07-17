# Best Books Guide 📚

The best books in a simple list.

Modern technology has enabled a limitless supply of information. By stripping down to the highest quality, most authoritative books on different subjects, you can cancel out the noise and use your time more efficiently. Best Books Guide is designed to keep things _simple_ and keep you _sane_.

An interactive website allows users to track their reading journey.

## Note for (human) developers

This is primarily a learning exercise for practising [full stack development](https://roadmap.sh/full-stack).

My idea was to spin up a full stack project with the suggested tech stack, and then use this as my personal sandbox to study the whole stack.

**Stack**: React 19 · Tailwind 4 · Fastify 5 (Node 24, TypeScript) · PostgreSQL 18 · Redis 8 · Terraform + Ansible on AWS (EC2/VPC/S3/Route53/SES) · GitHub Actions · Monit.

**Status**: 🟢 live at **[bestbooks.guide](https://bestbooks.guide/healthz)** — M1 walking skeleton shipped (self-deploys from `main`, no inbound SSH). [Uptime](https://stats.uptimerobot.com/1mUEBA341u) · [roadmap](docs/08-delivery-plan.md).

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

**M1 (walking skeleton) is done and deployed**: the whole pipeline — Terraform → Ansible → CI/CD → Monit → HTTPS — is live, and `main` deploys itself to `bestbooks.guide` over an SSM tunnel with zero manual steps. The web page reports API health via the shared contract (`curl https://bestbooks.guide/healthz` → `{"status":"ok",...}`). Features arrive from **M2 (accounts & auth)** onward — see the [delivery plan](docs/08-delivery-plan.md).