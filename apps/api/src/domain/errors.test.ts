import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from './errors.js';

describe('domain errors', () => {
  it.each([
    [new UnauthorizedError('nope'), 401, 'UnauthorizedError'],
    [new NotFoundError('missing'), 404, 'NotFoundError'],
    [new ConflictError('dupe'), 409, 'ConflictError'],
    [new ForbiddenError('nope'), 403, 'ForbiddenError'],
    [new ValidationError('bad'), 422, 'ValidationError'],
  ])('%s carries its status and name', (error, status, name) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.name).toBe(name);
  });

  it('preserves the message', () => {
    expect(new NotFoundError('book not found').message).toBe('book not found');
  });

  it('carries Retry-After on a rate-limit error', () => {
    const err = new RateLimitedError('slow down', 42);
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(42);
    expect(err.name).toBe('RateLimitedError');
  });
});
