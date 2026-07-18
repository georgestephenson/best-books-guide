import type { FastifyRequest, preHandlerHookHandler } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../domain/errors.js';
import type { AccessTokenService } from '../app/ports/token-services.js';
import type { Role, UserRepository } from '../app/ports/user-repository.js';

export interface AuthUser {
  id: string;
  role: Role;
  sid: string;
}

// The authenticated principal rides on the request for handlers to read.
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export interface AuthGuards {
  /** M — a valid access token. */
  requireMember: preHandlerHookHandler;
  /** MV — a valid token AND a verified email (read from the DB, not a claim). */
  requireVerified: preHandlerHookHandler;
  /** A — a valid token with the admin role. */
  requireAdmin: preHandlerHookHandler;
}

export interface AuthGuardsDeps {
  accessTokens: AccessTokenService;
  users: UserRepository;
}

/**
 * Route-level authn/authz. Verifying the access token hits no store ([ADR-0005]);
 * `role` comes from the claim. The `MV` gate is the deliberate exception: there is
 * no verified-email claim (adding one would go stale for ≤15 min after a user
 * verifies), so `requireVerified` reads `email_verified_at` from Postgres — a write
 * route that already touches the DB, so the hot-path property is preserved.
 */
export function createAuthGuards(deps: AuthGuardsDeps): AuthGuards {
  async function authenticate(request: FastifyRequest): Promise<AuthUser> {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('missing bearer token');
    }
    const claims = await deps.accessTokens.verify(header.slice('Bearer '.length));
    if (!claims) throw new UnauthorizedError('invalid or expired token');
    const user: AuthUser = { id: claims.sub, role: claims.role, sid: claims.sid };
    request.user = user;
    return user;
  }

  return {
    requireMember: async (request) => {
      await authenticate(request);
    },
    requireVerified: async (request) => {
      const principal = await authenticate(request);
      const user = await deps.users.findById(principal.id);
      if (!user) throw new UnauthorizedError('user not found');
      if (!user.emailVerifiedAt) throw new ForbiddenError('email verification required');
    },
    requireAdmin: async (request) => {
      const principal = await authenticate(request);
      if (principal.role !== 'admin') throw new ForbiddenError('admin only');
    },
  };
}
