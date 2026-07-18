import { RATE_LIMITS } from '@bestbooks/shared';
import { ConflictError, RateLimitedError, UnauthorizedError } from '../../domain/errors.js';
import type { Clock } from '../ports/clock.js';
import type { RateLimiter } from '../ports/security.js';
import type { SessionStore } from '../ports/session-store.js';
import type { AccessTokenService, RandomSource, TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';
import { REUSE_GRACE_MS } from '../auth-constants.js';
import { toPublicUser } from '../user-view.js';
import type { IssuedSession } from './session-issuer.js';

export interface RotateRefreshTokenInput {
  sessionId: string;
  refreshSecret: string;
}

export interface RotateRefreshTokenDeps {
  users: UserRepository;
  sessions: SessionStore;
  accessTokens: AccessTokenService;
  random: RandomSource;
  tokenHasher: TokenHasher;
  rateLimiter: RateLimiter;
  clock: Clock;
}

/**
 * Rotate the refresh token and mint a new access token (docs/05, [ADR-0005/0009]).
 *
 * - presented hash == current   → normal rotation.
 * - presented hash == previous, within the grace window → benign double-fire
 *   (boot/StrictMode/racing tabs), re-rotated to keep the session alive.
 * - anything else → reuse ⇒ theft: revoke the session, 409, full re-login.
 *
 * A missing/expired session is a 401 (409 is reserved for reuse specifically).
 */
export class RotateRefreshToken {
  constructor(private readonly deps: RotateRefreshTokenDeps) {}

  async execute(input: RotateRefreshTokenInput): Promise<IssuedSession> {
    const rl = await this.deps.rateLimiter.hit(
      'refresh',
      input.sessionId,
      RATE_LIMITS.refresh.limit,
      RATE_LIMITS.refresh.windowSeconds,
    );
    if (!rl.allowed) throw new RateLimitedError('too many refreshes', rl.retryAfterSeconds);

    const session = await this.deps.sessions.get(input.sessionId);
    if (!session) throw new UnauthorizedError('session not found');

    const presented = this.deps.tokenHasher.hash(input.refreshSecret);
    const now = this.deps.clock.now().getTime();
    const isCurrent = presented === session.tokenHash;
    const isGracePrev =
      session.prevTokenHash !== null &&
      presented === session.prevTokenHash &&
      now - session.rotatedAt <= REUSE_GRACE_MS;

    if (!isCurrent && !isGracePrev) {
      await this.deps.sessions.revoke(input.sessionId, session.userId);
      throw new ConflictError('refresh token reuse detected; session revoked');
    }

    const user = await this.deps.users.findById(session.userId);
    if (!user) {
      await this.deps.sessions.revoke(input.sessionId, session.userId);
      throw new UnauthorizedError('user not found');
    }

    const newSecret = this.deps.random.token();
    await this.deps.sessions.rotate(input.sessionId, {
      tokenHash: this.deps.tokenHasher.hash(newSecret),
      prevTokenHash: session.tokenHash,
      rotatedAt: now,
    });

    const accessToken = await this.deps.accessTokens.sign({
      sub: user.id,
      role: user.role,
      sid: input.sessionId,
    });

    return {
      sessionId: input.sessionId,
      refreshSecret: newSecret,
      accessToken,
      expiresIn: this.deps.accessTokens.ttlSeconds,
      user: toPublicUser(user),
    };
  }
}
