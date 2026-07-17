// Dedicated test stores, isolated from local dev data. Defaults match the
// docker-compose stack (docs/07 §Local env) and the CI service containers; both
// can be overridden. The integration tests own these — never the dev database.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://bestbooks:bestbooks@127.0.0.1:5432/bestbooks_test';

// db index 15 keeps FLUSHDB-between-tests off db 0, where a dev Redis keeps state.
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15';
