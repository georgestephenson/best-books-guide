import type { PublicUser } from '@bestbooks/shared';
import type { UserRepository } from '../ports/user-repository.js';
import { toPublicUser } from '../user-view.js';

export interface UpdateMeInput {
  userId: string;
  displayName: string;
}

export interface UpdateMeDeps {
  users: UserRepository;
}

/** Update the profile — display name only in MVP; email change is post-MVP (docs/04). */
export class UpdateMe {
  constructor(private readonly deps: UpdateMeDeps) {}

  async execute(input: UpdateMeInput): Promise<PublicUser> {
    const user = await this.deps.users.updateDisplayName(input.userId, input.displayName);
    return toPublicUser(user);
  }
}
