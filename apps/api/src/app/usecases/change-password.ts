import { ForbiddenError, UnauthorizedError, ValidationError } from '../../domain/errors.js';
import type { BreachedPasswordChecker, PasswordHasher } from '../ports/security.js';
import type { SessionStore } from '../ports/session-store.js';
import type { UserRepository } from '../ports/user-repository.js';
import type { IssuedSession, SessionIssuer } from './session-issuer.js';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordDeps {
  users: UserRepository;
  sessions: SessionStore;
  passwordHasher: PasswordHasher;
  breachedChecker: BreachedPasswordChecker;
  sessionIssuer: SessionIssuer;
}

/**
 * Change the password for the signed-in user (docs/04). Requires the current
 * password, then revokes every session and issues a fresh one — so other devices
 * are logged out ("revokes other sessions") while this one stays signed in with a
 * new refresh cookie + access token.
 */
export class ChangePassword {
  constructor(private readonly deps: ChangePasswordDeps) {}

  async execute(input: ChangePasswordInput): Promise<IssuedSession> {
    const user = await this.deps.users.findById(input.userId);
    if (!user) throw new UnauthorizedError('user not found');

    const ok = await this.deps.passwordHasher.verify(user.passwordHash, input.currentPassword);
    if (!ok) throw new ForbiddenError('current password is incorrect');

    if (this.deps.breachedChecker.isBreached(input.newPassword)) {
      throw new ValidationError('This password has appeared in a data breach; choose another.');
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
    await this.deps.users.updatePasswordHash(input.userId, passwordHash);
    await this.deps.sessions.revokeAllForUser(input.userId);

    return this.deps.sessionIssuer.issue({ ...user, passwordHash });
  }
}
