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
