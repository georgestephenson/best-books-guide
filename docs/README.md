# Best Books Guide — Design Documentation

_Last updated: 2026-07-12_

This is the design doc suite for **Best Books Guide**, a curated, opinionated catalogue of the best books by subject, where members track their reading, rate, and review.

## Reading order

| Doc | What it covers | Read it when |
|---|---|---|
| [01 — Product](01-product.md) | Vision, personas, MVP feature set, user stories, non-goals | You want to know **what** we're building |
| [02 — Architecture](02-architecture.md) | System context, monorepo layout, clean architecture, tech stack & rationale | You want to know **how** it's structured |
| [03 — Data model](03-data-model.md) | ERD, table specs, Redis keyspace, migrations | You're touching the schema |
| [04 — API](04-api.md) | REST conventions, endpoint catalogue, error format, pagination | You're building or consuming an endpoint |
| [05 — Security](05-security.md) | Auth design (JWT + refresh rotation), OWASP alignment, hardening | You're touching auth or handling user data |
| [06 — Infrastructure](06-infrastructure.md) | AWS topology (VPC/EC2/S3/Route53/SES), TLS, backups, DR, cost | You're touching Terraform or the host |
| [07 — Operations](07-operations.md) | CI/CD, Terraform & Ansible layout, deploys, Monit, logging, runbooks | You're deploying or on the hook when it breaks |
| [08 — Delivery plan](08-delivery-plan.md) | Milestones M0→M5, exit criteria, post-MVP backlog, risks | You're deciding what to do next |
| [adr/](adr/) | Architecture Decision Records — the *why* behind each significant choice | You're wondering "why didn't they use X?" |

## Principles

1. **Ship a walking skeleton first.** The full pipeline (Terraform → Ansible → CI/CD → Monit → HTTPS "hello world") goes live before features do. Every feature after that rides proven rails.
2. **Boring, current technology.** Versions and practices are chosen as of July 2026 and recorded here with rationale. Prefer the mainstream option unless an ADR says otherwise.
3. **Simple now, extensible by design.** One EC2 host today; every scaling step (split DB, ALB, CDN, SSR) is a documented path, not a rewrite.
4. **Decisions are written down.** Anything a future contributor would ask "why?" about gets an ADR.

## Conventions

- Docs are updated **in the same PR** as the change that invalidates them.
- New significant technical decisions get an ADR in [adr/](adr/) (next sequential number) — see [ADR-0001](adr/0001-record-architecture-decisions.md).
- Git conventions (Conventional Commits, branches, squash-merge PRs) are in [/CONTRIBUTING.md](../CONTRIBUTING.md).
- The canonical short-term task list is [/TODO.md](../TODO.md); the roadmap lives in [08 — Delivery plan](08-delivery-plan.md).
- Working agreements for AI-assisted sessions are in [/CLAUDE.md](../CLAUDE.md).

## Settled project facts

- **Domain**: `bestbooks.guide` — registered and DNS-hosted in Route53 (2026-07-12).
- **AWS region**: `eu-west-2` (London) — confirmed; a single Terraform variable if it ever changes.
- **GitHub repo**: `best-books-guide`.
