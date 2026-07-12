import type { HealthResponse } from '@bestbooks/shared';

export type HealthBadgeState = 'loading' | 'error' | 'ready';

interface HealthBadgeProps {
  state: HealthBadgeState;
  health?: HealthResponse;
}

/** Presentational — no data fetching, so it's trivially unit-testable in isolation. */
export function HealthBadge({ state, health }: HealthBadgeProps) {
  if (state === 'loading') {
    return <p className="text-slate-500">Checking API…</p>;
  }
  if (state === 'error' || !health) {
    return <p className="font-medium text-red-600">API unreachable</p>;
  }
  return (
    <p className="font-medium text-emerald-600">
      API {health.status} · {health.version} · up {health.uptimeSeconds}s
    </p>
  );
}
