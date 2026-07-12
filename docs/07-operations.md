# 07 — Operations

_Last updated: 2026-07-12 · Status: Accepted_

How the system is provisioned, deployed, observed, and fixed. Golden rule: **if it touched production, it went through code review and a pipeline** — the only console/manual acts are the documented bootstrap and break-glass runbooks.

## Environments

| Env | What | Notes |
|---|---|---|
| local | docker compose for PG 18 + Redis 8 only (dev deps, never prod); `npm run dev` runs api+web | `.env.example` kept current |
| ci | GitHub-hosted runners; PG/Redis as service containers for API integration tests | |
| prod | The EC2 host ([06](06-infrastructure.md)) | Protected GH environment |
| staging | **Deferred.** Added by re-applying the same TF module with `envs/staging` tfvars + a second Ansible inventory when the cost is justified | |

## Terraform

```
infra/terraform/
├── bootstrap/     # applied ONCE locally: state bucket (versioned, use_lockfile),
│                  # GitHub OIDC provider + CI role, AWS Budgets alarm
├── envs/prod/     # root module: backend config, provider, module wiring, prod.tfvars
└── modules/
    ├── network/   # VPC, subnets, IGW, S3 endpoint, SGs
    ├── compute/   # EC2, EIP, instance profile, key pair
    ├── dns/       # zone, records, CAA
    ├── email/     # SES identity, DKIM, MAIL FROM, DMARC records, Monit SMTP user
    └── storage/   # the four buckets + lifecycles
```

- **Versions**: Terraform ≥ 1.12, AWS provider `~> 6.0`, both pinned; Dependabot bumps them.
- **State**: S3 backend with `use_lockfile = true` (native S3 locking — the DynamoDB lock table is legacy practice as of TF 1.11+).
- **Workflow**: PR touching `infra/terraform/**` → `fmt -check`, `validate`, `tflint`, `plan` posted to the PR. Apply runs on merge to `main` gated by the `production` GH environment (manual approval click). Monthly scheduled `plan` detects drift.
- **CI auth**: OIDC role from bootstrap; `id-token: write`; role trust locked to this repo + environment. No AWS keys in GitHub.

## Ansible

```
infra/ansible/
├── inventories/prod/hosts.yml     # EIP DNS name; vars per group
├── group_vars/all/vault.yml       # Ansible Vault: DB/Redis/JWT secrets, SMTP creds
├── roles/
│   ├── common       # users, ssh hardening, ufw, unattended-upgrades, fail2ban, zstd/awscli
│   ├── nodejs       # Node 24 via NodeSource (arm64; bundles npm 11)
│   ├── postgresql   # PG 18 via PGDG apt, tuned for 2GB host, pg_trgm/citext, app role
│   ├── redis        # Redis 8 (official repo), localhost-only, maxmemory + LRU for cache keys
│   ├── nginx        # vhost: SPA static + /api proxy + /covers, TLS (certbot role-managed), headers
│   ├── monit        # all checks + SES SMTP alerting (below)
│   ├── backup       # systemd timers + scripts (pg_dump→S3, media sync, heartbeats)
│   └── app          # service user, /srv/bestbooks layout, systemd unit, .env from Vault
└── playbooks/
    ├── site.yml     # full converge (bootstrap or drift-fix); idempotent, safe to re-run
    └── deploy.yml   # app release only (below)
```

- ansible-core ≥ 2.19 (current line: 2.20/2.21), `ansible-lint` in CI, `--check --diff` supported by all roles.
- **Vault**: passphrase lives in a GH environment secret (CI) and the admin password manager (local). Rotating any app secret = edit vault + `deploy.yml`.
- **Bootstrap sequence** (documented once, scripted where possible): `terraform apply` → EIP into inventory → `site.yml` → certbot issue → `deploy.yml` → smoke test.

## CI/CD (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PRs + main | Parallel jobs over a cached `npm ci`: **(a)** lint + prettier + `tsc -b`, **(b)** Vitest unit + integration with coverage gates (PG+Redis service containers, migrations applied first), **(c)** build web+api → Playwright smoke (≤3 journeys; full e2e on main + nightly); `npm audit` (fail high); ansible-lint / tf fmt on those paths. **Budget: <7 min wall, tests <2 min** ([02 §Testing strategy](02-architecture.md)) |
| `deploy.yml` | push to `main` (app paths) / manual | needs ci → **build release on `ubuntu-24.04-arm`** (arm64-native modules for Graviton) → tar (api dist + pruned prod node_modules + web dist + migrations) → OIDC → upload `release-<sha>.tar.gz` to releases bucket → `ansible-playbook deploy.yml` over SSH (env-protected) |
| `terraform.yml` | infra paths | plan on PR / gated apply on main (above) |
| `codeql.yml` + Dependabot | schedule/PRs | static analysis; dep/action/TF bumps (actions pinned by SHA) |

Branch protection on `main`: CI required, one approving review required (solo-dev reality: self-review + admin merge is the documented exception; the ritual still forces reading the diff).

## Deploy mechanics on the host

```
/srv/bestbooks/
├── releases/<git-sha>/    # last 5 kept
├── current -> releases/<sha>
├── shared/.env            # Vault-rendered; symlinked into each release
└── media/                 # covers (backed to S3)
```

`deploy.yml` steps: fetch tarball from S3 (instance role) → unpack to `releases/<sha>` → link shared `.env` → **pre-migration `pg_dump`** → `drizzle-kit migrate` under PG advisory lock → swap `current` symlink → `systemctl restart bestbooks-api` → poll `/healthz` (10×3s) → on failure: swap symlink back, restart, **fail loudly**; migrations are expand-only so the previous release keeps working ([03 — Data model](03-data-model.md)) → prune old releases. Web assets are static files in the release; Nginx serves `current/apps/web/dist`.

systemd unit (`app` role): `User=bestbooks`, `EnvironmentFile=/srv/bestbooks/shared/.env`, `ExecStart=node /srv/bestbooks/current/apps/api/dist/main.js`, `Restart=on-failure`, `RestartSec=3`, hardening per [05 — Security](05-security.md), `SyslogIdentifier=bestbooks-api`.

**Rollback** = `deploy.yml -e release_sha=<previous>` (re-links + restarts; no rebuild). Runbook below.

## Monitoring — Monit

Monit is the watchdog **and** first responder: it restarts crashed services and emails when it does (alerts via SES SMTP, `set alert admin@…`). Web UI bound to localhost:2812 — access via SSH tunnel only.

| Check | Condition → action |
|---|---|
| `bestbooks-api` process | not running → restart; >3 restarts/5 cycles → alert only (stop flapping) |
| API health | `http://127.0.0.1:3000/healthz` status ≠ 200 for 2 cycles → restart + alert |
| Public URL | `https://bestbooks.guide/healthz` (cert implicitly validated) failed → alert |
| nginx / postgresql / redis | process down → restart + alert |
| Filesystem `/` | >80% alert, >90% alert urgent |
| Memory / load | >85% mem or load5 > cores×2 for 3 cycles → alert |
| TLS expiry | `check program` (openssl) — <21 days → alert (certbot should have renewed at 30) |
| Backup heartbeats | heartbeat file older than 26h → alert (silent-failure guard) |

Plus an **external** uptime ping (UptimeRobot free tier or similar) because Monit can't report the host being down ([TODO](../TODO.md)).

## Logging

- API: Pino JSON → stdout → **journald** (`SystemMaxUse=500M`); every line carries `requestId`.
- Nginx: access/error logs, logrotate 14d.
- PG: `log_min_duration_statement = 500ms` (slow-query visibility from day one).
- Cookbook: `journalctl -u bestbooks-api --since -1h`, `-o json | jq 'select(.requestId=="…")'`. Centralised logging is deliberately deferred — one host, journald is enough.

## Runbooks (each rehearsed once before launch)

1. **Deploy / Rollback** — above; rollback ≤ 2 min.
2. **Restore DB**: fetch dump from S3 → `pg_restore --clean --if-exists` into fresh DB → smoke test → repoint. Quarterly drill against a scratch DB on the host.
3. **Rebuild host from zero**: TF apply (new EIP → DNS) → `site.yml` → restore DB + media sync-back → `deploy.yml` → verify. Target ≤ 2h (the RTO).
4. **Incident triage**: Monit summary → `systemctl status` → journalctl of the failing unit → `df -h` / `free -h` / `top` → this doc's owner fixes forward or rolls back. Postmortem note in `docs/incidents/` if user-visible.
5. **Rotate secrets**: vault edit → `deploy.yml` (JWT secret uses dual-secret window: add new, deploy, drop old next deploy).
6. **Promote admin**: `sudo -u bestbooks node …/cli.js promote-admin <email>` (or documented SQL).
