import { RATE_LIMITS } from '@bestbooks/shared';
import { RateLimitedError, UnauthorizedError } from '../../domain/errors.js';
import type { PasswordHasher, RateLimiter } from '../ports/security.js';
import type { TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';
import { DUMMY_PASSWORD_HASH } from '../auth-constants.js';
import type { IssuedSession, SessionIssuer } from './session-issuer.js';

export interface LoginUserInput {
  email: string;
  password: string;
  ip: string;
}

export interface LoginUserDeps {
  users: UserRepository;
  passwordHasher: PasswordHasher;
  rateLimiter: RateLimiter;
  tokenHasher: TokenHasher;
  sessionIssuer: SessionIssuer;
}

/**
 * Verify credentials and start a session. Unknown-email and wrong-password both
 * return the same 401, and an unknown email still runs a dummy Argon2id verify so
 * the timing doesn't leak account existence (docs/05). The rate limit keys on
 * IP + a hash of the email (no PII in Redis keys); a success clears the counter.
 */
export class LoginUser {
  constructor(private readonly deps: LoginUserDeps) {}

  async execute(input: LoginUserInput): Promise<IssuedSession> {
    const rlKey = `${input.ip}:${this.deps.tokenHasher.hash(input.email.toLowerCase()).slice(0, 16)}`;
    const rl = await this.deps.rateLimiter.hit(
      'login',
      rlKey,
      RATE_LIMITS.login.limit,
      RATE_LIMITS.login.windowSeconds,
    );
    if (!rl.allowed) throw new RateLimitedError('too many attempts', rl.retryAfterSeconds);

    const user = await this.deps.users.findByEmail(input.email);
    if (!user) {
      // Burn comparable time so timing doesn't reveal the account is absent.
      await this.deps.passwordHasher.verify(DUMMY_PASSWORD_HASH, input.password);
      throw new UnauthorizedError('invalid email or password');
    }

    const ok = await this.deps.passwordHasher.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedError('invalid email or password');

    await this.deps.rateLimiter.reset('login', rlKey);
    return this.deps.sessionIssuer.issue(user);
  }
}
