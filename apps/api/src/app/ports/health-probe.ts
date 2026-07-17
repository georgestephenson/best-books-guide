/**
 * A liveness check for a backing store. Implementations must resolve `false` on a
 * failed/timed-out ping rather than throwing, so `GET /healthz` can report a
 * degraded store without erroring (docs/04 §healthz).
 */
export interface HealthProbe {
  ping(): Promise<boolean>;
}
