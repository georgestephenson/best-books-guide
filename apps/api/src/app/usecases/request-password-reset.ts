import { RATE_LIMITS } from '@bestbooks/shared';
import { RateLimitedError } from '../../domain/errors.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { RateLimiter } from '../ports/security.js';
import type { OneTimeTokenStore, RandomSource, TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';
import { RESET_TOKEN_TTL_SECONDS } from '../auth-constants.js';
import { passwordResetEmail } from '../auth-emails.js';

export interface RequestPasswordResetInput {
  email: string;
  ip: string;
}

export interface RequestPasswordResetDeps {
  users: UserRepository;
  oneTimeTokens: OneTimeTokenStore;
  emailSender: EmailSender;
  random: RandomSource;
  tokenHasher: TokenHasher;
  rateLimiter: RateLimiter;
  publicBaseUrl: string;
}

/**
 * Start a password reset. The response is uniform whether or not the account
 * exists (docs/05, route always 202); a reset email is sent only when it does.
 */
export class RequestPasswordReset {
  constructor(private readonly deps: RequestPasswordResetDeps) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const rl = await this.deps.rateLimiter.hit(
      'forgotPassword',
      input.ip,
      RATE_LIMITS.forgotPassword.limit,
      RATE_LIMITS.forgotPassword.windowSeconds,
    );
    if (!rl.allowed) throw new RateLimitedError('too many requests', rl.retryAfterSeconds);

    const user = await this.deps.users.findByEmail(input.email);
    if (!user) return;

    const token = this.deps.random.token();
    await this.deps.oneTimeTokens.issue(
      'password_reset',
      this.deps.tokenHasher.hash(token),
      user.id,
      RESET_TOKEN_TTL_SECONDS,
    );
    await this.deps.emailSender.send(
      passwordResetEmail(user.email, `${this.deps.publicBaseUrl}/reset-password?token=${token}`),
    );
  }
}
