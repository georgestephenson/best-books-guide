import type { Redis } from 'ioredis';
import type { RateLimiter, RateLimitResult } from '../../app/ports/security.js';

// INCR then, only on the first hit, set the window — atomic so concurrent requests
// can't each think they're first. Returns {count, ttl} (docs/03 key shape rl:{scope}:{key}).
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(
    scope: string,
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const [count, ttl] = (await this.redis.eval(
      HIT_SCRIPT,
      1,
      `rl:${scope}:${key}`,
      String(windowSeconds),
    )) as [number, number];

    return {
      allowed: count <= limit,
      // TTL can briefly read -1 between INCR and EXPIRE races; fall back to the window.
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  async reset(scope: string, key: string): Promise<void> {
    await this.redis.del(`rl:${scope}:${key}`);
  }
}
