import fastify, { type FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import helmet from '@fastify/helmet';
import type { Config } from '../config.js';
import type { GetHealth } from '../app/usecases/get-health.js';
import { healthRoutes } from './routes/health.js';
import { problemFromError } from './problem.js';

export interface ServerDeps {
  config: Config;
  getHealth: GetHealth;
}

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

  void app.register(helmet);
  void app.register(healthRoutes(deps.getHealth));

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
    void reply.status(problem.status).type('application/problem+json').send(problem);
  });

  return app;
}
