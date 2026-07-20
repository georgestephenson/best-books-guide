import { Redis } from 'ioredis';

/**
 * ioredis, chosen over node-redis for its first-class `eval` — the rate limiter
 * does an atomic INCR+EXPIRE in a Lua script, and ioredis makes that a plain
 * method call. The db index rides in the URL (`redis://…/15` in tests).
 *
 * `maxRetriesPerRequest: 1` keeps the "Redis down → fail closed" path fast
 * (docs/05): a login/refresh errors out in one round-trip rather than hanging.
 */
export function createRedis(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: 1 });
}
