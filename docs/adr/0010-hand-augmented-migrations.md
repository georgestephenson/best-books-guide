# ADR-0010 — Hand-augment generated migrations for constraints drizzle-kit can't express

_Status: Accepted · 2026-07-18_

## Context

[ADR-0004](0004-drizzle-over-prisma.md) picked Drizzle, and [03 — Data model](../03-data-model.md) §migrations commits to the drizzle-kit workflow: the schema in `apps/api/src/infra/db/schema/` is the source of truth, `drizzle-kit generate` diffs it against the committed snapshot (`drizzle/meta/*.json`) to emit reviewable SQL, and `dist/migrate.js` applies those files on deploy.

The M3 catalogue schema needs one constraint drizzle-kit's schema DSL cannot express: `list_items` must carry a **`UNIQUE (list_id, rank) DEFERRABLE INITIALLY DEFERRED`** so a whole-list reorder can swap ranks inside one transaction ([03 — Data model](../03-data-model.md) §list_items). drizzle-kit has no `DEFERRABLE` option. Everything else docs/03 asked for *did* survive generation — `num_nonnulls(...) = 1` via `check()`, the `gin_trgm_ops` indexes via `.using('gin', sql\`…\`)`, and "unique where not null" via plain `unique()` (Postgres treats NULLs as distinct) — so this is the narrow exception, not the rule.

Options considered: (a) hand-write the whole migration and drop drizzle-kit generation; (b) model rank ordering without a DB constraint (app-only uniqueness); (c) keep generation and hand-append the one statement drizzle can't emit.

## Decision

**Keep `drizzle-kit generate` as the default and hand-append only the statements it cannot express**, as extra SQL at the end of the generated migration file, clearly commented and pointing back to this ADR. Concretely, in `0001_catalogue.sql`:

```sql
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_rank_unique"
  UNIQUE ("list_id", "rank") DEFERRABLE INITIALLY DEFERRED;
```

Rules for the pattern:

- **Generate first, augment second.** Express everything possible in the schema DSL so the snapshot stays authoritative; only reach for raw SQL when the DSL genuinely can't (today: `DEFERRABLE`).
- **Augmented objects live outside the drizzle snapshot.** They are invisible to future `generate` diffs — drizzle won't recreate or drop them — so each is a standalone, idempotent-by-construction DDL statement that later migrations must maintain by hand if the table changes.
- **A hand-added constraint must be proved by an integration test**, since the snapshot round-trip won't catch a regression. `list_items_list_id_rank_unique` is covered by the deferred-swap and unique-at-commit tests in `test/catalogue-schema.test.ts`.
- **Meaningful migration filenames.** Rename drizzle-kit's random tag to a descriptive one (`0001_catalogue`) and update the journal entry to match — consistent with `0000_users_and_extensions`.

## Consequences

- The generate-and-review workflow is preserved for ~all of the schema; the deviation is one commented statement with a test guarding it. Reviewers see exactly what drizzle couldn't do and why.
- A future migration that alters `list_items` won't get the deferred constraint "for free" from a snapshot diff — whoever writes it must remember the hand-added object. The comment in the SQL and this ADR are the reminder; the integration test fails loudly if it's dropped.
- No third tool and no abandoning drizzle-kit: rejected (a) because we'd lose the diff-driven safety net for the 95% case, and (b) because a rank ordering enforced only in app code can drift under concurrent writes — the DB constraint is the point.
- Sets the precedent for later slices (e.g. any partial-index or exclusion-constraint need): same recipe — schema DSL where it reaches, a commented + tested SQL tail where it doesn't.
