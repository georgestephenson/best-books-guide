import { describe, expect, it } from 'vitest';
import { problemFromError, statusForError } from './problem.js';
import { NotFoundError } from '../domain/errors.js';

describe('statusForError', () => {
  it('uses a domain error’s own status', () => {
    expect(statusForError(new NotFoundError('x'))).toBe(404);
  });

  it('reads a valid Fastify-style statusCode', () => {
    expect(statusForError({ statusCode: 400 })).toBe(400);
  });

  it('ignores an out-of-range statusCode and falls back to 500', () => {
    expect(statusForError({ statusCode: 799 })).toBe(500);
    expect(statusForError({ statusCode: 'nope' })).toBe(500);
  });

  it('defaults an unknown throw to 500', () => {
    expect(statusForError(new Error('boom'))).toBe(500);
    expect(statusForError('a string')).toBe(500);
  });
});

describe('problemFromError', () => {
  it('exposes the message and a typed URI for client errors', () => {
    const problem = problemFromError(new NotFoundError('book not found'), 'req-1');
    expect(problem).toEqual({
      type: 'https://bestbooks.guide/errors/not-found',
      title: 'Not found',
      status: 404,
      detail: 'book not found',
      requestId: 'req-1',
    });
  });

  it('hides internal detail for server errors', () => {
    const problem = problemFromError(new Error('db exploded'), 'req-2');
    expect(problem.status).toBe(500);
    expect(problem.detail).toBe('Internal Server Error');
    expect(problem.requestId).toBe('req-2');
  });

  it('maps a Fastify schema-validation error to 422 with errors[]', () => {
    const problem = problemFromError(
      { validation: [{ instancePath: '/email', message: 'must match pattern' }] },
      'req-3',
    );
    expect(problem.status).toBe(422);
    expect(problem.type).toBe('https://bestbooks.guide/errors/validation');
    expect(problem.errors).toEqual([{ path: '/email', message: 'must match pattern' }]);
  });

  it('handles non-Error throws', () => {
    const problem = problemFromError('weird', 'req-4');
    expect(problem.status).toBe(500);
    expect(problem.detail).toBe('Internal Server Error');
  });
});
