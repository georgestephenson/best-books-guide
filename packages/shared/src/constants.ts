/** Versioned REST base path. Bumps only on breaking contract changes (docs/04-api.md). */
export const API_BASE_PATH = '/api/v1';

/** Liveness endpoint, served at the root by the API and watched by Monit (docs/07). */
export const HEALTH_PATH = '/healthz';
