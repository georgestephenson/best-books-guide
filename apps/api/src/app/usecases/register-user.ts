import { RATE_LIMITS } from '@bestbooks/shared';
import { ConflictError, RateLimitedError, ValidationError } from '../../domain/errors.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { BreachedPasswordChecker, PasswordHasher, RateLimiter } from '../ports/security.js';
import type { OneTimeTokenStore, RandomSource, TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';
import { VERIFY_TOKEN_TTL_SECONDS } from '../auth-constants.js';
import { existingAccountEmail, verificationEmail } from '../auth-emails.js';

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string;
  /** For the per-IP rate limit. */
  ip: string;
}

export interface RegisterUserDeps {
  users: UserRepository;
  passwordHasher: PasswordHasher;
  breachedChecker: BreachedPasswordChecker;
  oneTimeTokens: OneTimeTokenStore;
  emailSender: EmailSender;
  random: RandomSource;
  tokenHasher: TokenHasher;
  rateLimiter: RateLimiter;
  publicBaseUrl: string;
}

/**
 * Create an account and send a verification email. The response is always
 * 201-shaped (the route decides that) and never reveals whether the email was
 * already taken (docs/05): a duplicate quietly emails the real owner instead.
 */
export class RegisterUser {
  constructor(private readonly deps: RegisterUserDeps) {}

  async execute(input: RegisterUserInput): Promise<void> {
    const rl = await this.deps.rateLimiter.hit(
      'register',
      input.ip,
      RATE_LIMITS.register.limit,
      RATE_LIMITS.register.windowSeconds,
    );
    if (!rl.allowed) throw new RateLimitedError('too many registrations', rl.retryAfterSeconds);

    if (this.deps.breachedChecker.isBreached(input.password)) {
      throw new ValidationError('This password has appeared in a data breach; choose another.');
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.password);

    try {
      const user = await this.deps.users.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      });
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
    } catch (err) {
      if (err instanceof ConflictError) {
        await this.deps.emailSender.send(
          existingAccountEmail(
            input.email,
            `${this.deps.publicBaseUrl}/login`,
            `${this.deps.publicBaseUrl}/forgot-password`,
          ),
        );
        return;
      }
      throw err;
    }
  }
}
