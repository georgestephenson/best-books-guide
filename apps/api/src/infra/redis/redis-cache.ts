import type { Redis } from 'ioredis';
import type { Cache } from '../../app/ports/cache.js';

/** Cache adapter over Redis (docs/03 §Redis keyspace). Callers namespace their keys. */
export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }
}
