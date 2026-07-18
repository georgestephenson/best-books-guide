import fastify, { type FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { API_BASE_PATH } from '@bestbooks/shared';
import type { Config } from '../config.js';
import type { GetHealth } from '../app/usecases/get-health.js';
import { RateLimitedError } from '../domain/errors.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes, type AuthRoutesDeps } from './routes/auth.js';
import { meRoutes, type MeRoutesDeps } from './routes/me.js';
import { catalogueRoutes, type CatalogueRoutesDeps } from './routes/catalogue.js';
import { sitemapRoutes, type SitemapRoutesDeps } from './routes/sitemap.js';
import { problemFromError } from './problem.js';

export interface ServerDeps {
  config: Config;
  getHealth: GetHealth;
  // Optional so the health-only unit tests can build a minimal server; main.ts and
  // the integration harness always supply them.
  auth?: AuthRoutesDeps;
  me?: MeRoutesDeps;
  catalogue?: CatalogueRoutesDeps;
  sitemap?: SitemapRoutesDeps;
}

// docs/05 §HTTP headers. Helmet owns headers on API (/api/*) responses; Nginx owns
// the SPA document's headers. The exact CSP string is mirrored on both.
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  styleSrc: ["'self'", "'unsafe-inline'"],
  scriptSrc: ["'self'"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'self'"],
};

/**
 * Build (but don't start) the Fastify app. Pure wiring: adapters and use-cases
 * arrive already constructed from the composition root (main.ts), which keeps
 * this testable via `.inject()` with fakes.
 */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = fastify({
    // Full structured logging in dev/prod; silent under test to keep output clean.
    logger: deps.config.NODE_ENV === 'test' ? false : { level: deps.config.LOG_LEVEL },
    // Nginx is the only thing that talks to us, on loopback. Without this, request.ip
    // is always 127.0.0.1 and every per-IP rate limit (M2) collapses into one bucket.
    // Trusting just loopback means we read the X-Forwarded-For Nginx sets, no further.
    trustProxy: '127.0.0.1',
  }).withTypeProvider<TypeBoxTypeProvider>();

  void app.register(helmet, {
    hsts: { maxAge: 63072000, includeSubDomains: true }, // 2 years (docs/05)
    contentSecurityPolicy: { directives: CSP_DIRECTIVES },
  });
  void app.register(cookie); // parses the refresh cookie; values aren't signed (the secret is the credential)

  // OpenAPI from the TypeBox schemas (docs/04). The interactive UI is dev/test only;
  // exposing it in prod would need an admin gate, deferred.
  void app.register(swagger, {
    openapi: { info: { title: 'Best Books Guide API', version: '1' } },
  });
  if (deps.config.NODE_ENV !== 'production') {
    void app.register(swaggerUi, { routePrefix: '/api/docs' });
  }

  void app.register(healthRoutes(deps.getHealth));
  if (deps.auth) {
    void app.register(authRoutes(deps.auth), { prefix: `${API_BASE_PATH}/auth` });
  }
  if (deps.me) {
    void app.register(meRoutes(deps.me), { prefix: `${API_BASE_PATH}/me` });
  }
  if (deps.catalogue) {
    void app.register(catalogueRoutes(deps.catalogue), { prefix: API_BASE_PATH });
  }
  if (deps.sitemap) {
    // Root-mounted: sitemap.xml / robots.txt live at the site root, not under /api/v1.
    void app.register(sitemapRoutes(deps.sitemap));
  }

  app.setNotFoundHandler((request, reply) => {
    const problem = problemFromError(
      Object.assign(new Error(`Route ${request.method} ${request.url} not found`), {
        statusCode: 404,
      }),
      request.id,
    );
    void reply.status(404).type('application/problem+json').send(problem);
  });

  app.setErrorHandler((error, request, reply) => {
    const problem = problemFromError(error, request.id);
    if (problem.status >= 500) {
      request.log.error({ err: error }, 'request failed');
    }
    // 429s carry Retry-After (docs/04).
    if (error instanceof RateLimitedError) {
      void reply.header('retry-after', String(error.retryAfterSeconds));
    }
    void reply.status(problem.status).type('application/problem+json').send(problem);
  });

  return app;
}
