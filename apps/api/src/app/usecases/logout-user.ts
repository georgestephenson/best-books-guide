import type { SessionStore } from '../ports/session-store.js';
import type { TokenHasher } from '../ports/token-services.js';

export interface LogoutUserInput {
  sessionId: string | null;
  refreshSecret: string | null;
}

export interface LogoutUserDeps {
  sessions: SessionStore;
  tokenHasher: TokenHasher;
}

/**
 * Revoke the current session. Idempotent: a missing or non-matching cookie is a
 * no-op success (the route clears the cookie regardless). Requiring the secret to
 * match means a guessed session id can't be used to log someone else out.
 */
export class LogoutUser {
  constructor(private readonly deps: LogoutUserDeps) {}

  async execute(input: LogoutUserInput): Promise<void> {
    if (!input.sessionId || !input.refreshSecret) return;

    const session = await this.deps.sessions.get(input.sessionId);
    if (!session) return;

    const presented = this.deps.tokenHasher.hash(input.refreshSecret);
    if (presented === session.tokenHash || presented === session.prevTokenHash) {
      await this.deps.sessions.revoke(input.sessionId, session.userId);
    }
  }
}
