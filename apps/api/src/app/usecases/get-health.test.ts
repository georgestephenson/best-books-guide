import { describe, expect, it } from 'vitest';
import { GetHealth } from './get-health.js';
import type { Clock } from '../ports/clock.js';

const stubClock: Clock = {
  now: () => new Date('2026-07-12T00:00:00.000Z'),
  uptimeSeconds: () => 42,
};

describe('GetHealth', () => {
  it('reports ok with the injected version and uptime from the clock', () => {
    const getHealth = new GetHealth({ clock: stubClock, version: 'abc123' });

    expect(getHealth.execute()).toEqual({
      status: 'ok',
      version: 'abc123',
      uptimeSeconds: 42,
    });
  });
});
