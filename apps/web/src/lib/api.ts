import { HEALTH_PATH, type HealthResponse } from '@bestbooks/shared';
import { getAccessToken } from './authToken.js';
import { refreshSession } from './refresh.js';

/** RFC 9457 problem detail (docs/04). Field errors present on validation failures. */
export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: { path: string; message: string }[];
  requestId?: string;
}

/** Thrown for any non-2xx response; carries the parsed problem + Retry-After. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ApiProblem | null,
    readonly retryAfterSeconds: number | null,
  ) {
    super(problem?.detail ?? `Request failed (${status})`);
    this.name = 'ApiError';
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: ApiProblem | null = null;
  try {
    problem = (await res.json()) as ApiProblem;
  } catch {
    // non-JSON error body
  }
  const retryAfter = res.headers.get('retry-after');
  return new ApiError(res.status, problem, retryAfter ? Number(retryAfter) : null);
}

async function request(
  path: string,
  init: RequestInit | undefined,
  canRetry: boolean,
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await fetch(path, { ...init, headers, credentials: 'include' });

  // Only an authenticated request (had a token) whose token expired should try a
  // silent refresh + one retry — never login/register/etc., where a 401 is real.
  if (res.status === 401 && canRetry && token) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, init, false);
  }
  return res;
}

/** JSON request that throws `ApiError` on failure; returns `undefined` for 204. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init, true);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** The M1 health call, now routed through the shared client. */
export function fetchHealth(): Promise<HealthResponse> {
  return apiJson<HealthResponse>(HEALTH_PATH);
}
