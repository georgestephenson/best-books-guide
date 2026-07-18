import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import type { Config } from './config.js';
import type { Database } from './infra/db/pool.js';
import type { EmailSender } from './app/ports/email-sender.js';
import { SystemClock } from './infra/clock.js';
import { PgHealthProbe } from './infra/db/pg-health-probe.js';
import { RedisHealthProbe } from './infra/redis/redis-health-probe.js';
import { DrizzleUserRepository } from './infra/db/drizzle-user-repository.js';
import { RedisSessionStore } from './infra/redis/redis-session-store.js';
import { RedisOneTimeTokenStore } from './infra/redis/redis-one-time-token-store.js';
import { RedisRateLimiter } from './infra/redis/redis-rate-limiter.js';
import { Argon2PasswordHasher } from './infra/security/argon2-password-hasher.js';
import { ListBreachedPasswordChecker } from './infra/security/breached-password-checker.js';
import { JoseAccessTokenService } from './infra/security/jose-access-token-service.js';
import { NodeRandomSource, Sha256TokenHasher } from './infra/security/crypto.js';
import { SesEmailSender } from './infra/email/ses-email-sender.js';
import { LoggingEmailSender } from './infra/email/logging-email-sender.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './app/auth-constants.js';
import { GetHealth } from './app/usecases/get-health.js';
import { SessionIssuer } from './app/usecases/session-issuer.js';
import { RegisterUser } from './app/usecases/register-user.js';
import { VerifyEmail } from './app/usecases/verify-email.js';
import { ResendVerification } from './app/usecases/resend-verification.js';
import { LoginUser } from './app/usecases/login-user.js';
import { RotateRefreshToken } from './app/usecases/rotate-refresh-token.js';
import { LogoutUser } from './app/usecases/logout-user.js';
import { RequestPasswordReset } from './app/usecases/request-password-reset.js';
import { ResetPassword } from './app/usecases/reset-password.js';
import { GetMe } from './app/usecases/get-me.js';
import { UpdateMe } from './app/usecases/update-me.js';
import { ChangePassword } from './app/usecases/change-password.js';
import { createAuthGuards } from './http/auth-guards.js';
import type { ServerDeps } from './http/server.js';

export interface CompositionInput {
  config: Config;
  db: Database;
  pool: Pool;
  redis: Redis;
  /** Override the email transport (integration tests inject a capturing fake). */
  emailSender?: EmailSender;
}

/**
 * Build the full graph of adapters → use-cases → HTTP deps by hand (docs/02: no DI
 * framework). Shared by main.ts and the integration harness so the wiring lives in
 * exactly one place. This is the composition root — bootstrap, not business logic.
 */
export function composeServerDeps(input: CompositionInput): ServerDeps {
  const { config, db, pool, redis } = input;

  const clock = new SystemClock();
  const users = new DrizzleUserRepository(db);
  const sessions = new RedisSessionStore(redis);
  const oneTimeTokens = new RedisOneTimeTokenStore(redis);
  const rateLimiter = new RedisRateLimiter(redis);
  const passwordHasher = new Argon2PasswordHasher();
  const breachedChecker = new ListBreachedPasswordChecker();
  const tokenHasher = new Sha256TokenHasher();
  const random = new NodeRandomSource();
  const accessTokens = new JoseAccessTokenService({
    secret: config.JWT_SECRET,
    previousSecret: config.JWT_SECRET_PREVIOUS || undefined,
    issuer: config.PUBLIC_BASE_URL,
    audience: 'bestbooks-api',
    ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
  });
  const emailSender =
    input.emailSender ??
    (config.EMAIL_TRANSPORT === 'ses'
      ? new SesEmailSender(config.EMAIL_FROM, config.AWS_REGION)
      : new LoggingEmailSender());

  const publicBaseUrl = config.PUBLIC_BASE_URL;
  const sessionIssuer = new SessionIssuer({ clock, sessions, accessTokens, random, tokenHasher });
  const guards = createAuthGuards({ accessTokens, users });
  const secureCookie = config.NODE_ENV === 'production';

  const getHealth = new GetHealth({
    clock,
    version: config.APP_VERSION,
    db: new PgHealthProbe(pool),
    redis: new RedisHealthProbe(redis),
  });

  return {
    config,
    getHealth,
    auth: {
      registerUser: new RegisterUser({
        users,
        passwordHasher,
        breachedChecker,
        oneTimeTokens,
        emailSender,
        random,
        tokenHasher,
        rateLimiter,
        publicBaseUrl,
      }),
      verifyEmail: new VerifyEmail({ users, oneTimeTokens, tokenHasher, clock }),
      resendVerification: new ResendVerification({
        users,
        oneTimeTokens,
        emailSender,
        random,
        tokenHasher,
        rateLimiter,
        publicBaseUrl,
      }),
      loginUser: new LoginUser({ users, passwordHasher, rateLimiter, tokenHasher, sessionIssuer }),
      rotateRefreshToken: new RotateRefreshToken({
        users,
        sessions,
        accessTokens,
        random,
        tokenHasher,
        rateLimiter,
        clock,
      }),
      logoutUser: new LogoutUser({ sessions, tokenHasher }),
      requestPasswordReset: new RequestPasswordReset({
        users,
        oneTimeTokens,
        emailSender,
        random,
        tokenHasher,
        rateLimiter,
        publicBaseUrl,
      }),
      resetPassword: new ResetPassword({
        users,
        oneTimeTokens,
        sessions,
        passwordHasher,
        breachedChecker,
        tokenHasher,
        clock,
      }),
      guards,
      secureCookie,
    },
    me: {
      getMe: new GetMe({ users }),
      updateMe: new UpdateMe({ users }),
      changePassword: new ChangePassword({
        users,
        sessions,
        passwordHasher,
        breachedChecker,
        sessionIssuer,
      }),
      guards,
      secureCookie,
    },
  };
}
