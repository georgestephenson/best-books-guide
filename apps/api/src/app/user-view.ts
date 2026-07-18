import type { PublicUser } from '@bestbooks/shared';
import type { UserRecord } from './ports/user-repository.js';

/** Map a stored user to the client-safe view — drops the password hash by omission. */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  };
}
