import { describe, expect, it } from 'vitest';
import { SystemClock } from './clock.js';

describe('SystemClock', () => {
  const clock = new SystemClock();

  it('now() returns a Date', () => {
    expect(clock.now()).toBeInstanceOf(Date);
  });

  it('uptimeSeconds() returns a non-negative integer', () => {
    const uptime = clock.uptimeSeconds();
    expect(Number.isInteger(uptime)).toBe(true);
    expect(uptime).toBeGreaterThanOrEqual(0);
  });
});
