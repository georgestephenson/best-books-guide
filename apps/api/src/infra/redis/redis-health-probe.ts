import type { Redis } from 'ioredis';
import type { HealthProbe } from '../../app/ports/health-probe.js';

/** Liveness probe for Redis — a `PING`, reporting false rather than throwing. */
export class RedisHealthProbe implements HealthProbe {
  constructor(private readonly redis: Redis) {}

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
