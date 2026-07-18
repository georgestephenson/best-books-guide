import { ValidationError } from '../../domain/errors.js';
import type { Clock } from '../ports/clock.js';
import type { BreachedPasswordChecker, PasswordHasher } from '../ports/security.js';
import type { SessionStore } from '../ports/session-store.js';
import type { OneTimeTokenStore, TokenHasher } from '../ports/token-services.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ResetPasswordDeps {
  users: UserRepository;
  oneTimeTokens: OneTimeTokenStore;
  sessions: SessionStore;
  passwordHasher: PasswordHasher;
  breachedChecker: BreachedPasswordChecker;
  tokenHasher: TokenHasher;
  clock: Clock;
}

/**
 * Complete a password reset: set the new password, revoke every session (docs/04),
 * and — since receiving the email proves mailbox control — verify the address if it
 * wasn't already. Does not log the user in.
 */
export class ResetPassword {
  constructor(private readonly deps: ResetPasswordDeps) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    if (this.deps.breachedChecker.isBreached(input.newPassword)) {
      throw new ValidationError('This password has appeared in a data breach; choose another.');
    }

    const userId = await this.deps.oneTimeTokens.consume(
      'password_reset',
      this.deps.tokenHasher.hash(input.token),
    );
    if (!userId) throw new ValidationError('This reset link is invalid or has expired.');

    const user = await this.deps.users.findById(userId);
    if (!user) throw new ValidationError('This reset link is invalid or has expired.');

    const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
    await this.deps.users.updatePasswordHash(userId, passwordHash);
    if (!user.emailVerifiedAt) {
      await this.deps.users.markEmailVerified(userId, this.deps.clock.now());
    }
    await this.deps.sessions.revokeAllForUser(userId);
  }
}
