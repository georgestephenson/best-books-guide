import type { Redis } from 'ioredis';
import type { SessionRecord, SessionStore } from '../../app/ports/session-store.js';

const sessKey = (sid: string): string => `sess:${sid}`;
const idxKey = (userId: string): string => `sessidx:${userId}`;

/**
 * Redis-backed sessions (docs/03 keyspace). `sess:{sid}` is a hash; `sessidx:{userId}`
 * a set of that user's session ids for "log out everywhere". The absolute-expiry TTL
 * is set on create and never touched by rotate, so 30 days means 30 days from login.
 */
export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly now: () => number = Date.now,
  ) {}

  async create(sessionId: string, record: SessionRecord): Promise<void> {
    const ttl = Math.max(1, Math.ceil((record.expiresAt - this.now()) / 1000));
    await this.redis
      .multi()
      .hset(sessKey(sessionId), {
        userId: record.userId,
        tokenHash: record.tokenHash,
        prevTokenHash: record.prevTokenHash ?? '',
        rotatedAt: String(record.rotatedAt),
        expiresAt: String(record.expiresAt),
      })
      .expire(sessKey(sessionId), ttl)
      .sadd(idxKey(record.userId), sessionId)
      // The index set outlives individual sessions; bound it so a churny user can't
      // grow it forever (re-armed on every new session).
      .expire(idxKey(record.userId), ttl)
      .exec();
  }

  async get(sessionId: string): Promise<SessionRecord | null> {
    const h = await this.redis.hgetall(sessKey(sessionId));
    if (!h.userId) return null;
    return {
      userId: h.userId,
      tokenHash: h.tokenHash ?? '',
      prevTokenHash: h.prevTokenHash ? h.prevTokenHash : null,
      rotatedAt: Number(h.rotatedAt),
      expiresAt: Number(h.expiresAt),
    };
  }

  async rotate(
    sessionId: string,
    fields: { tokenHash: string; prevTokenHash: string; rotatedAt: number },
  ): Promise<void> {
    // HSET leaves the key's TTL intact — that's what keeps expiry absolute.
    await this.redis.hset(sessKey(sessionId), {
      tokenHash: fields.tokenHash,
      prevTokenHash: fields.prevTokenHash,
      rotatedAt: String(fields.rotatedAt),
    });
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await this.redis.multi().del(sessKey(sessionId)).srem(idxKey(userId), sessionId).exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sids = await this.redis.smembers(idxKey(userId));
    const pipeline = this.redis.multi();
    for (const sid of sids) pipeline.del(sessKey(sid));
    pipeline.del(idxKey(userId));
    await pipeline.exec();
  }
}
