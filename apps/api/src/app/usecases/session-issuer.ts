import type { PublicUser } from '@bestbooks/shared';
import type { Clock } from '../ports/clock.js';
import type { SessionStore } from '../ports/session-store.js';
import type { AccessTokenService, RandomSource, TokenHasher } from '../ports/token-services.js';
import type { UserRecord } from '../ports/user-repository.js';
import { SESSION_TTL_SECONDS } from '../auth-constants.js';
import { toPublicUser } from '../user-view.js';

export interface IssuedSession {
  /** The session id (goes in the cookie alongside the secret, and the JWT `sid`). */
  sessionId: string;
  /** The raw refresh secret — only its hash is stored; the route builds the cookie. */
  refreshSecret: string;
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
}

export interface SessionIssuerDeps {
  clock: Clock;
  sessions: SessionStore;
  accessTokens: AccessTokenService;
  random: RandomSource;
  tokenHasher: TokenHasher;
}

/**
 * Mints a fresh session + access token. Shared by login and password-change (both
 * start a new login); refresh rotates an existing session instead of using this.
 */
export class SessionIssuer {
  constructor(private readonly deps: SessionIssuerDeps) {}

  async issue(user: UserRecord): Promise<IssuedSession> {
    const sessionId = this.deps.random.sessionId();
    const refreshSecret = this.deps.random.token();
    const now = this.deps.clock.now().getTime();

    await this.deps.sessions.create(sessionId, {
      userId: user.id,
      tokenHash: this.deps.tokenHasher.hash(refreshSecret),
      prevTokenHash: null,
      rotatedAt: now,
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
    });

    const accessToken = await this.deps.accessTokens.sign({
      sub: user.id,
      role: user.role,
      sid: sessionId,
    });

    return {
      sessionId,
      refreshSecret,
      accessToken,
      expiresIn: this.deps.accessTokens.ttlSeconds,
      user: toPublicUser(user),
    };
  }
}
