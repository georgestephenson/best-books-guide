import { describe, expect, it } from 'vitest';
import { GetHealth } from './get-health.js';
import type { Clock } from '../ports/clock.js';
import type { HealthProbe } from '../ports/health-probe.js';

const stubClock: Clock = {
  now: () => new Date('2026-07-12T00:00:00.000Z'),
  uptimeSeconds: () => 42,
};

const probe = (up: boolean): HealthProbe => ({ ping: () => Promise.resolve(up) });

describe('GetHealth', () => {
  it('reports ok with the injected version and uptime when both stores answer', async () => {
    const getHealth = new GetHealth({
      clock: stubClock,
      version: 'abc123',
      db: probe(true),
      redis: probe(true),
    });

    await expect(getHealth.execute()).resolves.toEqual({
      status: 'ok',
      version: 'abc123',
      uptimeSeconds: 42,
      db: true,
      redis: true,
    });
  });

  it('reports degraded when a store is unreachable', async () => {
    const getHealth = new GetHealth({
      clock: stubClock,
      version: 'abc123',
      db: probe(true),
      redis: probe(false),
    });

    await expect(getHealth.execute()).resolves.toMatchObject({
      status: 'degraded',
      db: true,
      redis: false,
    });
  });
});
