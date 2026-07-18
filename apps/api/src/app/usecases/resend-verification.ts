import { RATE_LIMITS } from '@bestbooks/shared';
import { RateLimitedError, UnauthorizedError } from '../../domain/errors.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { RateLimiter } from '../ports/security.js';
import type { OneTimeTokenStore, RandomSource, TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';
import { VERIFY_TOKEN_TTL_SECONDS } from '../auth-constants.js';
import { verificationEmail } from '../auth-emails.js';

export interface ResendVerificationInput {
  userId: string;
}

export interface ResendVerificationDeps {
  users: UserRepository;
  oneTimeTokens: OneTimeTokenStore;
  emailSender: EmailSender;
  random: RandomSource;
  tokenHasher: TokenHasher;
  rateLimiter: RateLimiter;
  publicBaseUrl: string;
}

/** Re-send the verification email for the signed-in user. No-op if already verified. */
export class ResendVerification {
  constructor(private readonly deps: ResendVerificationDeps) {}

  async execute(input: ResendVerificationInput): Promise<void> {
    const rl = await this.deps.rateLimiter.hit(
      'resendVerification',
      input.userId,
      RATE_LIMITS.resendVerification.limit,
      RATE_LIMITS.resendVerification.windowSeconds,
    );
    if (!rl.allowed) throw new RateLimitedError('too many requests', rl.retryAfterSeconds);

    const user = await this.deps.users.findById(input.userId);
    if (!user) throw new UnauthorizedError('user not found');
    if (user.emailVerifiedAt) return;

    const token = this.deps.random.token();
    await this.deps.oneTimeTokens.issue(
      'verify_email',
      this.deps.tokenHasher.hash(token),
      user.id,
      VERIFY_TOKEN_TTL_SECONDS,
    );
    await this.deps.emailSender.send(
      verificationEmail(user.email, `${this.deps.publicBaseUrl}/verify-email?token=${token}`),
    );
  }
}
