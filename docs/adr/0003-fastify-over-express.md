# ADR-0003 — Fastify 5 over Express 5

_Status: Accepted · 2026-07-11_

## Context
The stack requires a Node.js REST API. The two mainstream 2026 candidates are Express 5 (stable since late 2024, npm default) and Fastify 5. Framework comparisons current in mid-2026 consistently conclude: Fastify for greenfield APIs (built-in JSON-Schema validation, first-class TypeScript, structured Pino logging, async-safe error handling, ~2–3× throughput); Express where team familiarity or legacy middleware dominates. NestJS was ruled out as a heavy abstraction that would hide the fundamentals this project exists to practice.

## Decision
Fastify 5, with TypeBox schemas via its type provider (one definition → runtime validation + static types + OpenAPI).

## Consequences
- Validation, serialisation (response-schema whitelisting), logging, and error handling come from the platform instead of hand-rolled middleware.
- Smaller middleware ecosystem than Express; the `@fastify/*` core plugins cover everything this design needs (jwt, cookie, helmet, rate-limit, swagger).
- The clean-architecture layering ([02 — Architecture](../02-architecture.md)) confines Fastify to `http/`; swapping to Express would touch one directory — the decision is cheap to reverse, which is why no more ink is spent on it.
