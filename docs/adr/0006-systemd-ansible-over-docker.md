# ADR-0006 — systemd + Ansible on the host; no containers in production

_Status: Accepted · 2026-07-11 (interview decision)_

## Context
The app must run on EC2 with Ansible configuration management and Monit monitoring — both named stack requirements. Options: containerise (Docker Compose on the host, image registry, container-aware monitoring) or run services natively (Ansible installs Node/PG/Redis/Nginx; systemd supervises; Monit watches processes).

## Decision
Native services under systemd, fully managed by Ansible roles. Docker exists only in development (compose for PG/Redis) and CI (service containers) — never on the production host.

## Consequences
- Ansible and Monit are exercised at full depth (the point of choosing them): real roles for real services, native process checks, systemd hardening.
- No image build/registry/pull pipeline; deploys are tarball + symlink + restart ([07 — Operations](../07-operations.md)) — fewer moving parts on a 2 GB host.
- Gives up image-level dev/prod parity; mitigated by pinning the same major versions (Node 24, PG 18, Redis 8) across compose, CI services, and Ansible roles.
- Native modules must match the host CPU: releases build on arm64 runners (documented in 07).
- If the platform later moves to containers/ECS, Ansible roles shrink to host bootstrap — evolution, not rewrite.
