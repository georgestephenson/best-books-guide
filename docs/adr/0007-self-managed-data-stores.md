# ADR-0007 — Self-managed PostgreSQL & Redis on the app host (no RDS/ElastiCache)

_Status: Accepted · 2026-07-11 (interview decision)_

## Context
Managed AWS data stores (RDS PostgreSQL ≥ ~$15/mo + storage; ElastiCache/Valkey ≥ ~$12/mo) roughly double the monthly bill and hide exactly the administration this project wants to practise. The stack list names PostgreSQL and Redis but deliberately not their managed forms; launch scale is a single small host.

## Decision
PostgreSQL 18 and Redis 8 run on the EC2 host, installed and tuned by Ansible roles, bound to localhost, backed up nightly to S3 with tested restores ([06 — Infrastructure](../06-infrastructure.md)).

## Consequences
- ~$25+/mo saved; deep Ansible/Postgres/Redis practice; everything on one host keeps latency and topology trivial.
- We own patching (unattended-upgrades + apt pinning), backups (nightly + heartbeat-monitored + quarterly restore drills), and tuning (role templates for a 2 GB host).
- Redis holds only rebuildable data ([03 — Data model](../03-data-model.md)) so its loss is an inconvenience, not an incident.
- **Revisit triggers**: sustained memory/IO pressure, backup/restore toil, need for HA, or multi-host web tier — step 2 of the scaling path moves data to a dedicated instance or RDS/ElastiCache with a dump/restore cutover.
