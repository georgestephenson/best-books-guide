import { HEALTH_PATH, type HealthResponse } from '@bestbooks/shared';

/**
 * The one typed API call in M1. Real endpoints get a shared client in M2+;
 * components never call `fetch` directly — they go through functions like this,
 * wrapped by TanStack Query (docs/02 §Frontend).
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(HEALTH_PATH);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}
