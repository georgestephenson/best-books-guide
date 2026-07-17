import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit generates SQL migrations by diffing the schema against the committed
 * migration history (docs/03 §migrations). It never touches a live database from a
 * dev machine — applying migrations is the deploy playbook's job, via `dist/migrate.js`.
 * So no `dbCredentials` here: this config drives `generate` only.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/db/schema/index.ts',
  out: './drizzle',
});
