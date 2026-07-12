/**
 * Typed domain errors. Use-cases throw these; the HTTP layer maps them to
 * RFC 9457 problem responses (docs/02 §request lifecycle, docs/04). The domain
 * never imports HTTP — it only knows a semantic status number.
 */
export abstract class DomainError extends Error {
  abstract readonly status: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly status = 404;
}

export class ConflictError extends DomainError {
  readonly status = 409;
}

export class ForbiddenError extends DomainError {
  readonly status = 403;
}

export class ValidationError extends DomainError {
  readonly status = 422;
}
