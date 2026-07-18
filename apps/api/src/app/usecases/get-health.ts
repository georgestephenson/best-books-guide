import type { HealthResponse } from '@bestbooks/shared';
import type { Clock } from '../ports/clock.js';
import type { HealthProbe } from '../ports/health-probe.js';

export interface GetHealthDeps {
  clock: Clock;
  version: string;
  db: HealthProbe;
  redis: HealthProbe;
}

/**
 * Liveness + store readiness for `GET /healthz`. Both probes are pinged in
 * parallel; the endpoint stays HTTP 200 even when a store is down (status flips to
 * 'degraded') so a Redis blip doesn't trip the Monit deploy gate into a restart
 * loop — the body, not the status code, carries the degradation (docs/04, docs/07).
 */
export class GetHealth {
  constructor(private readonly deps: GetHealthDeps) {}

  async execute(): Promise<HealthResponse> {
    const [db, redis] = await Promise.all([this.deps.db.ping(), this.deps.redis.ping()]);
    return {
      status: db && redis ? 'ok' : 'degraded',
      version: this.deps.version,
      uptimeSeconds: this.deps.clock.uptimeSeconds(),
      db,
      redis,
    };
  }
}
