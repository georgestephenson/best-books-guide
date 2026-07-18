import type { Pool } from 'pg';
import type { HealthProbe } from '../../app/ports/health-probe.js';

/** Liveness probe for PostgreSQL — a trivial `SELECT 1`. */
export class PgHealthProbe implements HealthProbe {
  constructor(private readonly pool: Pool) {}

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
