import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import type { Config } from './config.js';
import type { Database } from './infra/db/pool.js';
import type { EmailSender } from './app/ports/email-sender.js';
import type { OpenLibraryClient } from './app/ports/open-library-client.js';
import type { ImageStore } from './app/ports/image-store.js';
import { SystemClock } from './infra/clock.js';
import { PgHealthProbe } from './infra/db/pg-health-probe.js';
import { RedisHealthProbe } from './infra/redis/redis-health-probe.js';
import { DrizzleUserRepository } from './infra/db/drizzle-user-repository.js';
import { DrizzleCatalogueRepository } from './infra/db/drizzle-catalogue-repository.js';
import { DrizzleAdminCatalogueRepository } from './infra/db/drizzle-admin-catalogue-repository.js';
import { DrizzleAdminCurationRepository } from './infra/db/drizzle-admin-curation-repository.js';
import { RedisCache } from './infra/redis/redis-cache.js';
import { FsImageStore } from './infra/media/fs-image-store.js';
import { FetchOpenLibraryClient } from './infra/openlibrary/fetch-open-library-client.js';
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
import { GetSubjects } from './app/usecases/get-subjects.js';
import { GetSubject } from './app/usecases/get-subject.js';
import { GetList } from './app/usecases/get-list.js';
import { GetBooks } from './app/usecases/get-books.js';
import { GetBook } from './app/usecases/get-book.js';
import { GetSeries } from './app/usecases/get-series.js';
import { GetSitemap } from './app/usecases/get-sitemap.js';
import {
  CreateBook,
  DeleteBook,
  GetAdminBook,
  ImportBook,
  ListAdminBooks,
  SearchOpenLibrary,
  UpdateBook,
} from './app/usecases/admin-books.js';
import {
  CreateSubject,
  DeleteSubject,
  ListSubjects,
  ReorderSubjects,
  UpdateSubject,
} from './app/usecases/admin-subjects.js';
import {
  CreateList,
  DeleteList,
  GetAdminList,
  ListAdminLists,
  SetListItems,
  UpdateList,
} from './app/usecases/admin-lists.js';
import {
  CreateSeries,
  DeleteSeries,
  GetAdminSeries,
  ListAdminSeries,
  SetSeriesBooks,
  UpdateSeries,
} from './app/usecases/admin-series.js';
import { createAuthGuards } from './http/auth-guards.js';
import type { ServerDeps } from './http/server.js';

export interface CompositionInput {
  config: Config;
  db: Database;
  pool: Pool;
  redis: Redis;
  /** Override the email transport (integration tests inject a capturing fake). */
  emailSender?: EmailSender;
  /** Override Open Library / cover storage (tests inject fakes so no network/fs). */
  openLibrary?: OpenLibraryClient;
  imageStore?: ImageStore;
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
  const catalogue = new DrizzleCatalogueRepository(db);
  const adminCatalogue = new DrizzleAdminCatalogueRepository(db);
  const adminCuration = new DrizzleAdminCurationRepository(db);
  const cache = new RedisCache(redis);
  const imageStore = input.imageStore ?? new FsImageStore(config.MEDIA_DIR);
  const openLibrary = input.openLibrary ?? new FetchOpenLibraryClient(config.OPENLIBRARY_BASE_URL);
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
    catalogue: {
      getSubjects: new GetSubjects(catalogue),
      getSubject: new GetSubject(catalogue),
      getList: new GetList(catalogue),
      getBooks: new GetBooks(catalogue),
      getBook: new GetBook(catalogue),
      getSeries: new GetSeries(catalogue),
    },
    sitemap: {
      getSitemap: new GetSitemap(catalogue),
      publicBaseUrl,
    },
    admin: {
      guards,
      searchOpenLibrary: new SearchOpenLibrary({ ol: openLibrary, cache }),
      importBook: new ImportBook({
        repo: adminCatalogue,
        ol: openLibrary,
        images: imageStore,
        coversBaseUrl: config.OPENLIBRARY_COVERS_URL,
      }),
      listBooks: new ListAdminBooks(adminCatalogue),
      createBook: new CreateBook(adminCatalogue),
      getBook: new GetAdminBook(adminCatalogue),
      updateBook: new UpdateBook(adminCatalogue),
      deleteBook: new DeleteBook(adminCatalogue),
      listSubjects: new ListSubjects(adminCatalogue),
      createSubject: new CreateSubject(adminCatalogue),
      updateSubject: new UpdateSubject(adminCatalogue),
      deleteSubject: new DeleteSubject(adminCatalogue),
      reorderSubjects: new ReorderSubjects(adminCatalogue),
      listLists: new ListAdminLists(adminCuration),
      createList: new CreateList(adminCuration),
      getList: new GetAdminList(adminCuration),
      updateList: new UpdateList(adminCuration),
      deleteList: new DeleteList(adminCuration),
      setListItems: new SetListItems(adminCuration),
      listSeries: new ListAdminSeries(adminCuration),
      createSeries: new CreateSeries(adminCuration),
      getSeries: new GetAdminSeries(adminCuration),
      updateSeries: new UpdateSeries(adminCuration),
      deleteSeries: new DeleteSeries(adminCuration),
      setSeriesBooks: new SetSeriesBooks(adminCuration),
    },
  };
}
