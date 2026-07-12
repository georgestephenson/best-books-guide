import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from './errors.js';

describe('domain errors', () => {
  it.each([
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
});
