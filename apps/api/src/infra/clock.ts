import type { Clock } from '../app/ports/clock.js';

/** Production adapter for the Clock port. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  uptimeSeconds(): number {
    return Math.floor(process.uptime());
  }
}
