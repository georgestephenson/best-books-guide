import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/**
 * 12-factor configuration, validated at boot so a typo fails fast and loud
 * rather than at 3am (docs/02 §Cross-cutting concerns).
 */
const ConfigSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal('development'), Type.Literal('test'), Type.Literal('production')],
    { default: 'development' },
  ),
  HOST: Type.String({ default: '127.0.0.1', minLength: 1 }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal('fatal'),
      Type.Literal('error'),
      Type.Literal('warn'),
      Type.Literal('info'),
      Type.Literal('debug'),
      Type.Literal('trace'),
      Type.Literal('silent'),
    ],
    { default: 'info' },
  ),
  /** Git SHA of the running release, injected by the deploy pipeline; 'dev' locally. */
  APP_VERSION: Type.String({ default: 'dev', minLength: 1 }),

  // Data stores (docs/03). Defaults target the local docker-compose stack so dev
  // and tests are zero-config; prod always sets these explicitly from env.j2.
  DATABASE_URL: Type.String({
    default: 'postgresql://bestbooks:bestbooks@127.0.0.1:5432/bestbooks',
    minLength: 1,
  }),
  REDIS_URL: Type.String({ default: 'redis://127.0.0.1:6379', minLength: 1 }),

  // Auth (docs/05). The access-token signing secret; the dev default is obviously
  // not a secret — prod always sets a 256-bit value from Vault.
  JWT_SECRET: Type.String({ default: 'dev-insecure-jwt-secret-change-me', minLength: 16 }),
  // Set only during a rotation: the previous secret, still accepted for verify so
  // in-flight access tokens survive the window (docs/07 §Runbooks).
  JWT_SECRET_PREVIOUS: Type.String({ default: '' }),

  // Absolute base URL of the site, used to build email links and as the JWT `iss`.
  PUBLIC_BASE_URL: Type.String({ default: 'http://localhost:5173', minLength: 1 }),

  // Transactional email. 'log' writes the message to the logger (dev/test — no SES
  // call, no sandbox limits); 'ses' sends via the instance role.
  EMAIL_TRANSPORT: Type.Union([Type.Literal('log'), Type.Literal('ses')], { default: 'log' }),
  EMAIL_FROM: Type.String({ default: 'Best Books Guide <no-reply@localhost>', minLength: 1 }),
  AWS_REGION: Type.String({ default: 'eu-west-2', minLength: 1 }),

  // Catalogue admin (docs/04 §Admin). Open Library is the import source; covers
  // land on local disk under MEDIA_DIR, served at /covers/ by nginx (docs/02). Prod
  // sets MEDIA_DIR to {app_dir}/media via env.j2; the dev default is a repo-local dir.
  OPENLIBRARY_BASE_URL: Type.String({ default: 'https://openlibrary.org', minLength: 1 }),
  OPENLIBRARY_COVERS_URL: Type.String({ default: 'https://covers.openlibrary.org', minLength: 1 }),
  MEDIA_DIR: Type.String({ default: './media', minLength: 1 }),
});

export type Config = Static<typeof ConfigSchema>;

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  // Apply schema defaults for anything missing, then coerce string env vars to their real types.
  const defaulted = Value.Default(ConfigSchema, { ...source }) as Record<string, unknown>;
  const converted = Value.Convert(ConfigSchema, defaulted);

  if (!Value.Check(ConfigSchema, converted)) {
    const details = [...Value.Errors(ConfigSchema, converted)]
      .map((e) => `  - ${e.path || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return converted;
}
