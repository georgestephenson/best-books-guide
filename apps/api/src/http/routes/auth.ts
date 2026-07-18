import type { FastifyReply } from 'fastify';
import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AuthResponse,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from '@bestbooks/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { RegisterUser } from '../../app/usecases/register-user.js';
import type { VerifyEmail } from '../../app/usecases/verify-email.js';
import type { ResendVerification } from '../../app/usecases/resend-verification.js';
import type { LoginUser } from '../../app/usecases/login-user.js';
import type { RotateRefreshToken } from '../../app/usecases/rotate-refresh-token.js';
import type { LogoutUser } from '../../app/usecases/logout-user.js';
import type { RequestPasswordReset } from '../../app/usecases/request-password-reset.js';
import type { ResetPassword } from '../../app/usecases/reset-password.js';
import type { IssuedSession } from '../../app/usecases/session-issuer.js';
import type { AuthGuards } from '../auth-guards.js';
import { clearRefreshCookie, parseRefreshCookie, setRefreshCookie } from '../refresh-cookie.js';
import { REFRESH_COOKIE_NAME } from '../refresh-cookie.js';

export interface AuthRoutesDeps {
  registerUser: RegisterUser;
  verifyEmail: VerifyEmail;
  resendVerification: ResendVerification;
  loginUser: LoginUser;
  rotateRefreshToken: RotateRefreshToken;
  logoutUser: LogoutUser;
  requestPasswordReset: RequestPasswordReset;
  resetPassword: ResetPassword;
  guards: AuthGuards;
  /** Secure flag for the refresh cookie — false in dev (http), true in prod. */
  secureCookie: boolean;
}

const MessageResponse = Type.Object({ message: Type.String() });
const VerifiedResponse = Type.Object({ verified: Type.Boolean() });

/** Auth endpoints (docs/04), mounted under /api/v1/auth. */
export function authRoutes(deps: AuthRoutesDeps): FastifyPluginAsyncTypebox {
  return async (app) => {
    // Set the refresh cookie and return the AuthResponse body (login / refresh /
    // password change all end the same way).
    function sessionBody(reply: FastifyReply, session: IssuedSession) {
      setRefreshCookie(reply, session.sessionId, session.refreshSecret, deps.secureCookie);
      return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
    }

    app.post(
      '/register',
      { schema: { body: RegisterBody, response: { 201: MessageResponse } } },
      async (request, reply) => {
        await deps.registerUser.execute({ ...request.body, ip: request.ip });
        // Always 201-shaped, whether or not the email was already taken (docs/05).
        return reply.code(201).send({ message: 'Check your email to confirm your account.' });
      },
    );

    app.post(
      '/verify-email',
      { schema: { body: VerifyEmailBody, response: { 200: VerifiedResponse } } },
      async (request) => {
        await deps.verifyEmail.execute(request.body);
        return { verified: true };
      },
    );

    app.post(
      '/resend-verification',
      { preHandler: deps.guards.requireMember, schema: { response: { 202: MessageResponse } } },
      async (request, reply) => {
        await deps.resendVerification.execute({ userId: request.user!.id });
        return reply
          .code(202)
          .send({ message: 'If your email is unverified, a new link is on its way.' });
      },
    );

    app.post(
      '/login',
      { schema: { body: LoginBody, response: { 200: AuthResponse } } },
      async (request, reply) => {
        const session = await deps.loginUser.execute({ ...request.body, ip: request.ip });
        return sessionBody(reply, session);
      },
    );

    app.post(
      '/refresh',
      { schema: { response: { 200: AuthResponse } } },
      async (request, reply) => {
        const parsed = parseRefreshCookie(request.cookies[REFRESH_COOKIE_NAME]);
        if (!parsed) throw new UnauthorizedError('missing refresh cookie');
        const session = await deps.rotateRefreshToken.execute(parsed);
        return sessionBody(reply, session);
      },
    );

    app.post('/logout', async (request, reply) => {
      const parsed = parseRefreshCookie(request.cookies[REFRESH_COOKIE_NAME]);
      await deps.logoutUser.execute({
        sessionId: parsed?.sessionId ?? null,
        refreshSecret: parsed?.refreshSecret ?? null,
      });
      clearRefreshCookie(reply, deps.secureCookie);
      return reply.code(204).send();
    });

    app.post(
      '/forgot-password',
      { schema: { body: ForgotPasswordBody, response: { 202: MessageResponse } } },
      async (request, reply) => {
        await deps.requestPasswordReset.execute({ email: request.body.email, ip: request.ip });
        // Uniform 202 whether or not the account exists (docs/05).
        return reply
          .code(202)
          .send({ message: 'If that account exists, a reset link is on its way.' });
      },
    );

    app.post(
      '/reset-password',
      { schema: { body: ResetPasswordBody, response: { 200: MessageResponse } } },
      async (request) => {
        await deps.resetPassword.execute(request.body);
        return { message: 'Your password has been reset. Please sign in.' };
      },
    );
  };
}
