# ADR-0004 — Drizzle ORM over Prisma

_Status: Accepted · 2026-07-11_

## Context
TypeScript data layer for PostgreSQL 18. 2026 candidates: Prisma 7 (schema-first DSL, generated client, mature migrate tooling) and Drizzle (TypeScript-native schema, SQL-shaped queries, SQL-file migrations). By early 2026 Drizzle leads new-project adoption in comparable templates. A deliberate project goal is *actually practising PostgreSQL*, not abstracting it away.

## Decision
Drizzle ORM + drizzle-kit migrations.

## Consequences
- Queries read like SQL and complex ones drop to raw SQL naturally — the learning goal is served; EXPLAIN-ability is direct.
- Migrations are plain SQL files, reviewed in PRs and applied by the deploy playbook — no shadow-database machinery on the host.
- Types infer from the schema code; no generate step to forget.
- Gives up Prisma's richer migration guard-rails and ecosystem; mitigated by the expand→contract migration policy ([03 — Data model](../03-data-model.md)) and pre-migration dumps ([07 — Operations](../07-operations.md)).
