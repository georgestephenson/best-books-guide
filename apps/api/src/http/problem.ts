import { DomainError } from '../domain/errors.js';

/** RFC 9457 problem detail (docs/04 §Errors). */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId: string;
}

/** Map any thrown value to an HTTP status: domain errors know theirs; Fastify errors carry statusCode; else 500. */
export function statusForError(error: unknown): number {
  if (error instanceof DomainError) {
    return error.status;
  }
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number' && code >= 400 && code <= 599) {
      return code;
    }
  }
  return 500;
}

/** Build the problem+json body, hiding internal detail behind a generic message for 5xx. */
export function problemFromError(error: unknown, requestId: string): Problem {
  const status = statusForError(error);
  return {
    type: 'about:blank',
    title: error instanceof Error ? error.name : 'Error',
    status,
    detail:
      status >= 500 ? 'Internal Server Error' : error instanceof Error ? error.message : 'Error',
    requestId,
  };
}
