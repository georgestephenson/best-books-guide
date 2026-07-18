import { loadConfig } from './config.js';
import { createDb } from './infra/db/pool.js';
import { createRedis } from './infra/redis/client.js';
import { composeServerDeps } from './composition.js';
import { buildServer } from './http/server.js';

/**
 * Process bootstrap: open the stores, compose the dependency graph, and start
 * listening. The wiring itself lives in composition.ts (shared with the tests).
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const { db, pool } = createDb(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);

  const app = buildServer(composeServerDeps({ config, db, pool, redis }));

  // Fastify awaits onClose before app.close() resolves, so the stores drain before
  // the process exits (the old code exited immediately after close()).
  app.addHook('onClose', async () => {
    await pool.end();
    await redis.quit().catch(() => redis.disconnect());
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
