import { ValidationError } from '../../domain/errors.js';
import type { Clock } from '../ports/clock.js';
import type { OneTimeTokenStore, TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyEmailDeps {
  users: UserRepository;
  oneTimeTokens: OneTimeTokenStore;
  tokenHasher: TokenHasher;
  clock: Clock;
}

/**
 * Consume a verification token (single-use) and stamp `email_verified_at`. Does not
 * log the user in — the link is often opened in a different browser (docs/04).
 */
export class VerifyEmail {
  constructor(private readonly deps: VerifyEmailDeps) {}

  async execute(input: VerifyEmailInput): Promise<void> {
    const userId = await this.deps.oneTimeTokens.consume(
      'verify_email',
      this.deps.tokenHasher.hash(input.token),
    );
    if (!userId) throw new ValidationError('This verification link is invalid or has expired.');
    await this.deps.users.markEmailVerified(userId, this.deps.clock.now());
  }
}
