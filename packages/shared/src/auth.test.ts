import { describe, expect, it } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { LoginBody, RegisterBody, ResetPasswordBody, PublicUser, AuthResponse } from './auth.js';
import { RATE_LIMITS } from './rate-limits.js';

describe('auth contract', () => {
  it('accepts a well-formed registration', () => {
    expect(
      Value.Check(RegisterBody, {
        email: 'reader@example.com',
        password: 'correcthorse',
        displayName: 'Reader',
      }),
    ).toBe(true);
  });

  it('rejects a malformed email', () => {
    expect(Value.Check(LoginBody, { email: 'not-an-email', password: 'correcthorse' })).toBe(false);
  });

  it('rejects a short password (min 10)', () => {
    expect(Value.Check(LoginBody, { email: 'a@b.co', password: 'short' })).toBe(false);
  });

  it('rejects unknown properties', () => {
    expect(
      Value.Check(ResetPasswordBody, { token: 'x', newPassword: 'correcthorse', admin: true }),
    ).toBe(false);
  });

  it('models the public user without a password hash', () => {
    const ok = Value.Check(PublicUser, {
      id: '1',
      email: 'a@b.co',
      displayName: 'A',
      role: 'member',
      emailVerifiedAt: null,
    });
    expect(ok).toBe(true);
    // A hash field is not part of the contract, so it can never be serialised out.
    expect(Object.keys(PublicUser.properties)).not.toContain('passwordHash');
  });

  it('shapes the auth response with an expiry hint', () => {
    expect(Object.keys(AuthResponse.properties)).toEqual(['accessToken', 'expiresIn', 'user']);
  });
});

describe('rate limits', () => {
  it('keeps login the tightest window', () => {
    expect(RATE_LIMITS.login).toEqual({ limit: 5, windowSeconds: 900 });
    expect(RATE_LIMITS.register.limit).toBe(3);
  });
});
