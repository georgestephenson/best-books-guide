import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * One test runner across the monorepo (docs/02 §Testing strategy).
 * Per-project environments; coverage + gates aggregated at the root.
 *
 * `@bestbooks/shared` is aliased to its TypeScript source so tests never depend
 * on a prior `npm run build` of the package (its main/exports point at dist,
 * which doesn't exist on a clean CI checkout). The compiled API still consumes
 * dist at runtime — that path goes through tsc, which builds shared first.
 */
const sharedAlias = {
  '@bestbooks/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    // Serialize test files across the whole run. The integration files share one
    // `bestbooks_test` database and TRUNCATE between tests (docs/02), so two of them
    // running concurrently would wipe each other's rows mid-test. The suite is small
    // enough (~seconds) that global serialization stays well inside the speed budget.
    // Must be set at the root, not per-project — the project-level flag is ignored.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias: sharedAlias },
        test: { name: 'shared', root: './packages/shared', environment: 'node' },
      },
      {
        resolve: { alias: sharedAlias },
        // Unit tests only — pure use-cases and HTTP wiring with in-memory fakes.
        // Runs without any data stores.
        test: {
          name: 'api',
          root: './apps/api',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias: sharedAlias },
        // Integration tests against real PG + Redis (docs/02). globalSetup migrates
        // once. Needs the stores up (`docker compose up -d`) — run `npm run test:unit`
        // to skip. Coverage still aggregates into the one report via `npm test`.
        test: {
          name: 'api-integration',
          root: './apps/api',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          globalSetup: ['./test/global-setup.ts'],
        },
      },
      {
        resolve: { alias: sharedAlias },
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'happy-dom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*-fakes.ts', // in-memory port doubles used only by unit tests
        '**/test/**',
        '**/*.d.ts',
        '**/index.ts', // barrel re-exports — no logic to cover
        'apps/api/src/main.ts', // process bootstrap — exercised by deploy smoke, not unit tests
        'apps/api/src/composition.ts', // hand-wired DI root — construction only, no logic to unit-test
        'apps/api/src/migrate.ts', // one-shot migration CLI — exercised by the deploy step and globalSetup
        'apps/api/src/promote-admin.ts', // one-shot admin-bootstrap CLI — process wiring; the repo method is tested
        'apps/api/src/seed-catalogue.ts', // one-shot seed CLI — process wiring; applySeed is tested
        'apps/web/src/main.tsx',
        'apps/web/src/routes.tsx', // route table / router bootstrap
        'apps/web/src/lib/queryClient.ts', // DI bootstrap wiring
      ],
      thresholds: {
        // Repo-wide floor + ratchet (a PR never lowers coverage)
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        // Business logic earns a higher bar — cheap tests, expensive bugs
        'packages/shared/src/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'apps/api/src/domain/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'apps/api/src/app/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
