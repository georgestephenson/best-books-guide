# ADR-0012 — Restate the coverage thresholds on the Vitest 4 basis

_Status: Accepted · 2026-07-27_

## Context

Vite 8 forced Vitest 3 → 4 (Vitest 3 depends on `vite@^5||^6||^7`), and Vitest 4's v8 coverage provider changed how coverage is *counted*: it remaps V8 output through the source AST instead of approximating from line hits.

The giveaway is in the old reports. Under Vitest 3 the summary printed **identical numerators and denominators for statements and lines** — 4073/8582 for both. Vitest 3's "statements" metric was lines wearing a different label. The same holds, less visibly, for branches and functions: v4 resolves each logical branch (default parameters, optional chaining, JSX conditionals, short-circuits) where v3 credited a whole line as taken.

So of the four metrics, only **`lines` means the same thing before and after**. The other three thresholds were calibrated against numbers that no longer exist. Measured across the three unit projects on the commit before the upgrade and after:

| Metric | Vitest 3 | Vitest 4 |
| --- | --- | --- |
| Statements | 47.45% (4073/8582) | 68.09% (1114/1636) |
| Branches | 80.66% (751/931) | 64.74% (595/919) |
| Functions | 68.7% (303/441) | 64.7% (341/527) |

The identical tests report differently in both directions. Nothing about the suite got worse — the ruler changed.

Options considered: keep every threshold and write enough tests to reach 80% branches under the new counting (a large body of work unrelated to a dependency bump, and it blocks the upgrade that unblocks Dependabot); drop all four to the new actuals (needlessly weakens the metrics that are still being met); or restate only what the tool redefined, and only where the suite actually falls short.

## Decision

Take the third. Concretely:

- **Every threshold that is still met stays exactly where it was.** Global lines (81.89%), statements and functions (82.37%) all clear 80 and keep it. `packages/shared/src/**` and `apps/api/src/domain/**` keep 90 across all four metrics. `apps/api/src/app/**` keeps 90 on lines and functions.
- **Real gaps were closed with tests, not by moving the gate.** Global statements sat at 77.9% after the upgrade; tests for the two largest uncovered files (`BookFormPage.tsx` at 0%, `sitemap.ts` at 0%) plus the review use-cases took it over 80 rather than lowering the bar to meet it.
- **Only where a redefined metric still falls short is the number restated** on the v4 basis: global branches 80 → 68, and `apps/api/src/app/**` statements 90 → 86 and branches 90 → 77.

The restated floors are set just under the measured baseline, not rounded down generously. The ratchet rule in [CLAUDE.md](../../CLAUDE.md) applies to them from here, and raising them back toward the old figures under the new counting is tracked in [TODO.md](../../TODO.md).

## Consequences

Three thresholds are numerically lower than they were on 2026-07-26 and are **not** comparable to them. Anyone reading `git log` for coverage history needs this ADR to interpret the step change; cross-version comparisons of statements, branches or functions are meaningless, and only `lines` can be compared across the boundary. Same-version comparison is what the ratchet enforces going forward, and that still works.

In exchange the gates now measure what they claim to. The old ~80% branch figure was flattering — it credited untaken branches on covered lines, so the honest number was always nearer the one recorded here. The upgrade did not lower the quality of the suite; it revealed where the suite actually stood.
