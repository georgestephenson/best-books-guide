import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { HEALTH_PATH } from '@bestbooks/shared';
import type { GetHealth } from '../../app/usecases/get-health.js';

const HealthSchema = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]),
  version: Type.String(),
  uptimeSeconds: Type.Integer(),
  db: Type.Boolean(),
  redis: Type.Boolean(),
});

/**
 * Liveness route. The response schema and the shared HealthResponse type must agree —
 * the handler returns HealthResponse, so a drift is a compile error.
 */
export function healthRoutes(getHealth: GetHealth): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get(HEALTH_PATH, { schema: { response: { 200: HealthSchema } } }, async () =>
      getHealth.execute(),
    );
  };
}
