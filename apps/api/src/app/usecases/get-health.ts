import type { HealthResponse } from '@bestbooks/shared';
import type { Clock } from '../ports/clock.js';

export interface GetHealthDeps {
  clock: Clock;
  version: string;
}

/**
 * The one use-case in the M1 walking skeleton. Trivial today, but it proves the
 * shape: HTTP → use-case → ports, returning a type shared with the web client.
 * In M2 it gains DB/Redis liveness pings via new ports.
 */
export class GetHealth {
  constructor(private readonly deps: GetHealthDeps) {}

  execute(): HealthResponse {
    return {
      status: 'ok',
      version: this.deps.version,
      uptimeSeconds: this.deps.clock.uptimeSeconds(),
    };
  }
}
