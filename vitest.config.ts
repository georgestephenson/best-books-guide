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
    projects: [
      {
        resolve: { alias: sharedAlias },
        test: { name: 'shared', root: './packages/shared', environment: 'node' },
      },
      {
        resolve: { alias: sharedAlias },
        test: { name: 'api', root: './apps/api', environment: 'node' },
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
        '**/test/**',
        '**/*.d.ts',
        '**/index.ts', // barrel re-exports — no logic to cover
        'apps/api/src/main.ts', // composition root / process bootstrap — exercised by deploy smoke, not unit tests
        'apps/web/src/main.tsx',
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
