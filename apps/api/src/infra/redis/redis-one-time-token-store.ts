import type { Redis } from 'ioredis';
import type {
  OneTimeTokenPurpose,
  OneTimeTokenStore,
} from '../../app/ports/token-services.js';

// docs/03 keyspace: everify:{tokenHash} (24h), pwreset:{tokenHash} (1h).
const prefix: Record<OneTimeTokenPurpose, string> = {
  verify_email: 'everify',
  password_reset: 'pwreset',
};

const key = (purpose: OneTimeTokenPurpose, tokenHash: string): string =>
  `${prefix[purpose]}:${tokenHash}`;

export class RedisOneTimeTokenStore implements OneTimeTokenStore {
  constructor(private readonly redis: Redis) {}

  async issue(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(key(purpose, tokenHash), userId, 'EX', ttlSeconds);
  }

  async consume(purpose: OneTimeTokenPurpose, tokenHash: string): Promise<string | null> {
    // GETDEL makes it single-use atomically — no check-then-delete race.
    return this.redis.getdel(key(purpose, tokenHash));
  }
}
