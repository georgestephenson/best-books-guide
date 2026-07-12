import { loadConfig } from './config.js';
import { SystemClock } from './infra/clock.js';
import { GetHealth } from './app/usecases/get-health.js';
import { buildServer } from './http/server.js';

/**
 * Composition root: build the adapters, inject them into the use-cases, wire the
 * HTTP layer, and start listening. This is the only place that knows every layer.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const clock = new SystemClock();
  const getHealth = new GetHealth({ clock, version: config.APP_VERSION });

  const app = buildServer({ config, getHealth });

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
