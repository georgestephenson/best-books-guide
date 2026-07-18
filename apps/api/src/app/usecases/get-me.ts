import type { PublicUser } from '@bestbooks/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { UserRepository } from '../ports/user-repository.js';
import { toPublicUser } from '../user-view.js';

export interface GetMeDeps {
  users: UserRepository;
}

/** The signed-in user's profile — role and verification state included (docs/04). */
export class GetMe {
  constructor(private readonly deps: GetMeDeps) {}

  async execute(input: { userId: string }): Promise<PublicUser> {
    const user = await this.deps.users.findById(input.userId);
    if (!user) throw new UnauthorizedError('user not found');
    return toPublicUser(user);
  }
}
