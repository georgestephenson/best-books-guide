import { DomainError } from '../domain/errors.js';

/** One field-level validation failure (docs/04 §Errors). */
export interface ProblemErrorItem {
  path: string;
  message: string;
}

/** RFC 9457 problem detail (docs/04 §Errors). */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: ProblemErrorItem[];
  requestId: string;
}

const ERROR_BASE = 'https://bestbooks.guide/errors';

// status → { slug for the type URI, human title }.
const BY_STATUS: Record<number, { slug: string; title: string }> = {
  400: { slug: 'bad-request', title: 'Malformed request' },
  401: { slug: 'unauthenticated', title: 'Authentication required' },
  403: { slug: 'forbidden', title: 'Forbidden' },
  404: { slug: 'not-found', title: 'Not found' },
  409: { slug: 'conflict', title: 'Conflict' },
  422: { slug: 'validation', title: 'Request failed validation' },
  429: { slug: 'rate-limited', title: 'Too many requests' },
  500: { slug: 'internal', title: 'Internal Server Error' },
};

/** A Fastify schema-validation error carries a `validation` array; we map it to 422. */
interface FastifyValidationError {
  validation: { instancePath?: string; message?: string }[];
}

function isValidationError(error: unknown): error is FastifyValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    Array.isArray((error as { validation?: unknown }).validation)
  );
}

/** Domain errors know their status; Fastify errors carry statusCode; else 500. */
export function statusForError(error: unknown): number {
  if (error instanceof DomainError) return error.status;
  if (isValidationError(error)) return 422; // schema failures are 422, not Fastify's default 400
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number' && code >= 400 && code <= 599) return code;
  }
  return 500;
}

/** Build the problem+json body, masking internal detail behind a generic 5xx message. */
export function problemFromError(error: unknown, requestId: string): Problem {
  const status = statusForError(error);
  const meta = BY_STATUS[status] ?? BY_STATUS[500]!;

  const problem: Problem = {
    type: `${ERROR_BASE}/${meta.slug}`,
    title: meta.title,
    status,
    detail:
      status >= 500 ? 'Internal Server Error' : error instanceof Error ? error.message : 'Error',
    requestId,
  };

  if (isValidationError(error)) {
    problem.detail = 'One or more fields are invalid.';
    problem.errors = error.validation.map((v) => ({
      path: v.instancePath && v.instancePath.length > 0 ? v.instancePath : '(root)',
      message: v.message ?? 'invalid',
    }));
  }

  return problem;
}
