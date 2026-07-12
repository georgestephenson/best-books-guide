# Contributing

A solo project, but the conventions are deliberately canonical — this repo is a learning exercise in working the way a well-run team would (see README). Design docs: [docs/](docs/README.md) · tasks: [TODO.md](TODO.md) · session agreements: [CLAUDE.md](CLAUDE.md).

## Commit messages — Conventional Commits

Every commit follows [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <subject>          # scope optional

<body — the why; wrap at 72>        # optional for trivial changes

<footer(s)>                         # optional
```

### Types (the standard set — no custom types)

| Type | Use for |
|---|---|
| `feat` | New capability a user or operator can see — app features *and* infra capabilities (`feat(terraform): add SES module`) |
| `fix` | Bug fix, security fix, infra misconfiguration fix |
| `docs` | docs/, ADRs, README, comment-only changes |
| `refactor` | Code restructuring with **no behaviour change** |
| `test` | Tests only |
| `perf` | Performance improvement |
| `build` | Build system, bundling, dependency bumps (`build(deps): …`) |
| `ci` | GitHub Actions workflows, pipeline config |
| `chore` | Repo plumbing that fits nowhere above — not a dumping ground |
| `style` | Formatting only (rare — Prettier owns this) |
| `revert` | Reverts; keep the body `git revert` generates |

There is deliberately no `infra` type: infra changes use standard types with an infra scope, which keeps tooling (commitlint, changelog generators) on defaults.

### Scopes (mirror the repo layout)

`api` · `web` · `shared` · `db` (schema/migrations — worth its own signal even though it lives in api) · `terraform` · `ansible` · `deps`. Omit the scope for repo-wide changes; if one commit needs two scopes, it usually wants to be two commits.

### Subject line

- **Imperative, present tense** — test: *"if applied, this commit will \<subject\>"* ("add", "bind", "remove"; never "added"/"adding").
- ≤ 72 chars hard limit, ~50 as the target; lowercase after the colon; no trailing period.
- Say the actual thing: `fix(ansible): bind redis to localhost only`, never `fix stuff` / `updates` / `wip`.

### Body

Explain **why** and with what consequences — the diff already shows *how*. Required whenever the subject alone wouldn't let future-you understand the motivation. Reference the design docs when implementing a decision (e.g. `Implements the rotation flow from ADR-0005`).

### Footers

- Breaking changes: `!` after the type/scope **and** a `BREAKING CHANGE:` footer. Here that means an incompatible `/api/v1` contract change or a non-rollback-safe migration — rare and deliberate ([03 — Data model](docs/03-data-model.md) expand→contract policy).
- Issue links: `Closes #12`, `Refs #12`.
- Attribution trailers (`Co-authored-by:`) are kept, including on AI-assisted commits.

### Examples (from this project's actual roadmap)

```
feat(api): rotate refresh tokens with reuse detection

Implements the session-family model from ADR-0005: each refresh
issues a new opaque token and stores only its hash; presenting a
stale token revokes the whole family and forces re-login.

Refs docs/05-security.md
```

```
fix(ansible): bind redis to localhost only
feat(terraform): add SES identity with DKIM and custom MAIL FROM
feat(db): add reading_statuses table
docs(adr): switch package manager to npm workspaces (ADR-0002)
build(deps): bump fastify from 5.3.1 to 5.4.2
ci: build release artifacts on arm64 runners
```

### Anti-patterns

`wip` / `misc` / `fix stuff` · past tense · mixing a refactor with a behaviour change in one commit (splits keep review and `git bisect` honest) · a body that narrates the diff line-by-line · five unrelated changes under one `chore`.

## Branches & pull requests

- Branch names: `<type>/<short-kebab-description>` — `feat/shelf-endpoints`, `fix/redis-bind`, `docs/commit-conventions`.
- Everything lands via PR, even solo ([CLAUDE.md](CLAUDE.md)). **Squash-merge only**: the PR title becomes the commit on `main`, so **PR titles must be valid Conventional Commit subjects**. Branch commits should still follow the pattern — they are what gets reviewed.
- PR description: what/why, link to the docs/ADR/TODO item it serves, screenshots for UI changes.

## Enforcement

- M1 adds **commitlint** (`@commitlint/config-conventional`): CI validates the PR title (the future `main` commit). A husky `commit-msg` hook is an optional local extra — and incidentally good npm-lifecycle practice (`prepare` script).
- The payoff for the discipline: a readable `git log`, working `git bisect`, changelog automation (conventional-changelog / release-please) for free later — and if `packages/shared` is ever published, commit types map straight onto semver bumps.

Also worth reading once: [How to Write a Git Commit Message](https://cbea.ms/git-commit/) — the classic seven rules this all builds on.
