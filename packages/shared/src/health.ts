/**
 * Contract for `GET /healthz` — shared by the Fastify response schema and the web client,
 * so the two can never drift (docs/02 §packages/shared). Grows a `db`/`redis` field in M2.
 */
export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  /** Git SHA of the running release, or 'dev' locally. */
  version: string;
  /** Seconds since the API process started. */
  uptimeSeconds: number;
}
