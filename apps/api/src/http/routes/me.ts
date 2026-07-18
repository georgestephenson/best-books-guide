import { type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AuthResponse, ChangePasswordBody, PublicUser, UpdateMeBody } from '@bestbooks/shared';
import type { GetMe } from '../../app/usecases/get-me.js';
import type { UpdateMe } from '../../app/usecases/update-me.js';
import type { ChangePassword } from '../../app/usecases/change-password.js';
import type { AuthGuards } from '../auth-guards.js';
import { setRefreshCookie } from '../refresh-cookie.js';

export interface MeRoutesDeps {
  getMe: GetMe;
  updateMe: UpdateMe;
  changePassword: ChangePassword;
  guards: AuthGuards;
  secureCookie: boolean;
}

/** Profile endpoints (docs/04), mounted under /api/v1/me. All require a member token. */
export function meRoutes(deps: MeRoutesDeps): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get(
      '/',
      { preHandler: deps.guards.requireMember, schema: { response: { 200: PublicUser } } },
      async (request) => deps.getMe.execute({ userId: request.user!.id }),
    );

    app.patch(
      '/',
      {
        preHandler: deps.guards.requireMember,
        schema: { body: UpdateMeBody, response: { 200: PublicUser } },
      },
      async (request) =>
        deps.updateMe.execute({ userId: request.user!.id, displayName: request.body.displayName }),
    );

    app.put(
      '/password',
      {
        preHandler: deps.guards.requireMember,
        schema: { body: ChangePasswordBody, response: { 200: AuthResponse } },
      },
      async (request, reply) => {
        const session = await deps.changePassword.execute({
          userId: request.user!.id,
          currentPassword: request.body.currentPassword,
          newPassword: request.body.newPassword,
        });
        // Every other session was revoked; this device gets a fresh cookie + token.
        setRefreshCookie(reply, session.sessionId, session.refreshSecret, deps.secureCookie);
        return {
          accessToken: session.accessToken,
          expiresIn: session.expiresIn,
          user: session.user,
        };
      },
    );
  };
}
