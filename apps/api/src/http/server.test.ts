import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { HEALTH_PATH } from '@bestbooks/shared';
import { buildServer } from './server.js';
import { loadConfig } from '../config.js';
import { GetHealth } from '../app/usecases/get-health.js';
import type { Clock } from '../app/ports/clock.js';

const stubClock: Clock = { now: () => new Date(), uptimeSeconds: () => 7 };

function testServer(getHealth: GetHealth): FastifyInstance {
  const config = loadConfig({ NODE_ENV: 'test', APP_VERSION: 'test-sha' });
  return buildServer({ config, getHealth });
}

describe('GET /healthz', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = testServer(new GetHealth({ clock: stubClock, version: 'test-sha' }));
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and the health contract', async () => {
    const res = await app.inject({ method: 'GET', url: HEALTH_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: 'test-sha', uptimeSeconds: 7 });
  });

  it('sets security headers from helmet', async () => {
    const res = await app.inject({ method: 'GET', url: HEALTH_PATH });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('unknown route', () => {
  it('returns a 404 problem+json', async () => {
    const app = testServer(new GetHealth({ clock: stubClock, version: 'test-sha' }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 404, title: 'Error' });
    await app.close();
  });
});

describe('error handling', () => {
  it('maps a thrown error to a 500 problem+json', async () => {
    const boom = new GetHealth({ clock: stubClock, version: 'x' });
    // Force the use-case to throw so the error handler runs.
    Object.defineProperty(boom, 'execute', {
      value: () => {
        throw new Error('boom');
      },
    });
    const app = testServer(boom);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: HEALTH_PATH });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ status: 500, detail: 'Internal Server Error' });
    await app.close();
  });
});
