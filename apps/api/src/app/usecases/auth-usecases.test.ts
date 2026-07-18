import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeAccessTokenService,
  FakeBreachedChecker,
  FakeEmailSender,
  FakeOneTimeTokenStore,
  FakePasswordHasher,
  FakeRateLimiter,
  FakeSessionStore,
  FakeTokenHasher,
  FakeUserRepository,
  FixedClock,
  SequentialRandom,
  makeUser,
} from './auth-fakes.js';
import { SessionIssuer } from './session-issuer.js';
import { RegisterUser } from './register-user.js';
import { LoginUser } from './login-user.js';
import { LogoutUser } from './logout-user.js';
import { VerifyEmail } from './verify-email.js';
import { ResendVerification } from './resend-verification.js';
import { RequestPasswordReset } from './request-password-reset.js';
import { ResetPassword } from './reset-password.js';
import { GetMe } from './get-me.js';
import { UpdateMe } from './update-me.js';
import { ChangePassword } from './change-password.js';
import {
  ConflictError,
  ForbiddenError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from '../../domain/errors.js';

const BASE = 'https://app.test';

// Fresh fakes per test.
function ctx() {
  const users = new FakeUserRepository();
  const sessions = new FakeSessionStore();
  const oneTimeTokens = new FakeOneTimeTokenStore();
  const rateLimiter = new FakeRateLimiter();
  const passwordHasher = new FakePasswordHasher();
  const breachedChecker = new FakeBreachedChecker(new Set(['password123']));
  const emailSender = new FakeEmailSender();
  const tokenHasher = new FakeTokenHasher();
  const random = new SequentialRandom();
  const accessTokens = new FakeAccessTokenService();
  const clock = new FixedClock();
  const sessionIssuer = new SessionIssuer({
    clock,
    sessions,
    accessTokens,
    random,
    tokenHasher,
  });
  return {
    users,
    sessions,
    oneTimeTokens,
    rateLimiter,
    passwordHasher,
    breachedChecker,
    emailSender,
    tokenHasher,
    random,
    accessTokens,
    clock,
    sessionIssuer,
  };
}

describe('RegisterUser', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));

  const deps = (x: typeof c) => ({
    users: x.users,
    passwordHasher: x.passwordHasher,
    breachedChecker: x.breachedChecker,
    oneTimeTokens: x.oneTimeTokens,
    emailSender: x.emailSender,
    random: x.random,
    tokenHasher: x.tokenHasher,
    rateLimiter: x.rateLimiter,
    publicBaseUrl: BASE,
  });

  it('rejects when rate-limited', async () => {
    c.rateLimiter.setBlocked(120);
    await expect(
      new RegisterUser(deps(c)).execute({
        email: 'a@b.co',
        password: 'longenough1',
        displayName: 'A',
        ip: '1.1.1.1',
      }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('rejects a breached password', async () => {
    await expect(
      new RegisterUser(deps(c)).execute({
        email: 'a@b.co',
        password: 'password123',
        displayName: 'A',
        ip: '1.1.1.1',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates the user and sends a verification email', async () => {
    await new RegisterUser(deps(c)).execute({
      email: 'a@b.co',
      password: 'longenough1',
      displayName: 'A',
      ip: '1.1.1.1',
    });
    expect(c.emailSender.sent[0]!.subject).toMatch(/confirm your email/i);
  });

  it('on a duplicate, emails the owner and does not throw', async () => {
    await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    c.emailSender.sent.length = 0;
    await new RegisterUser(deps(c)).execute({
      email: 'a@b.co',
      password: 'longenough1',
      displayName: 'A',
      ip: '1.1.1.1',
    });
    expect(c.emailSender.sent[0]!.subject).toMatch(/already have an account/i);
  });
});

describe('LoginUser', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) =>
    new LoginUser({
      users: x.users,
      passwordHasher: x.passwordHasher,
      rateLimiter: x.rateLimiter,
      tokenHasher: x.tokenHasher,
      sessionIssuer: x.sessionIssuer,
    });

  it('429s when rate-limited', async () => {
    c.rateLimiter.setBlocked();
    await expect(
      uc(c).execute({ email: 'a@b.co', password: 'x', ip: '1.1.1.1' }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('401s (via dummy verify) for an unknown email', async () => {
    await expect(
      uc(c).execute({ email: 'ghost@b.co', password: 'whatever10', ip: '1.1.1.1' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('401s on a wrong password', async () => {
    await c.users.create({ email: 'a@b.co', passwordHash: 'h:right-one-11', displayName: 'A' });
    await expect(
      uc(c).execute({ email: 'a@b.co', password: 'wrong-one-11', ip: '1.1.1.1' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('issues a session and clears the counter on success', async () => {
    await c.users.create({ email: 'a@b.co', passwordHash: 'h:right-one-11', displayName: 'A' });
    const out = await uc(c).execute({ email: 'a@b.co', password: 'right-one-11', ip: '1.1.1.1' });
    expect(out.accessToken).toMatch(/^jwt:/);
    expect(c.rateLimiter.resets).toHaveLength(1);
  });
});

describe('LogoutUser', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) => new LogoutUser({ sessions: x.sessions, tokenHasher: x.tokenHasher });

  it('is a no-op with no cookie', async () => {
    await expect(uc(c).execute({ sessionId: null, refreshSecret: null })).resolves.toBeUndefined();
  });

  it('is a no-op for an unknown session', async () => {
    await expect(uc(c).execute({ sessionId: 'nope', refreshSecret: 's' })).resolves.toBeUndefined();
  });

  it('does not revoke on a secret mismatch', async () => {
    await c.sessions.create('sid-1', {
      userId: 'u',
      tokenHash: 't:right',
      prevTokenHash: null,
      rotatedAt: 0,
      expiresAt: 9e15,
    });
    await uc(c).execute({ sessionId: 'sid-1', refreshSecret: 'wrong' });
    expect(c.sessions.records.has('sid-1')).toBe(true);
  });

  it('revokes on a matching secret', async () => {
    await c.sessions.create('sid-1', {
      userId: 'u',
      tokenHash: 't:right',
      prevTokenHash: null,
      rotatedAt: 0,
      expiresAt: 9e15,
    });
    await uc(c).execute({ sessionId: 'sid-1', refreshSecret: 'right' });
    expect(c.sessions.records.has('sid-1')).toBe(false);
  });
});

describe('VerifyEmail', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) =>
    new VerifyEmail({
      users: x.users,
      oneTimeTokens: x.oneTimeTokens,
      tokenHasher: x.tokenHasher,
      clock: x.clock,
    });

  it('rejects an invalid token', async () => {
    await expect(uc(c).execute({ token: 'bogus' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('marks the email verified', async () => {
    const user = await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    await c.oneTimeTokens.issue('verify_email', 't:tok', user.id);
    await uc(c).execute({ token: 'tok' });
    expect((await c.users.findById(user.id))!.emailVerifiedAt).not.toBeNull();
  });
});

describe('ResendVerification', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) =>
    new ResendVerification({
      users: x.users,
      oneTimeTokens: x.oneTimeTokens,
      emailSender: x.emailSender,
      random: x.random,
      tokenHasher: x.tokenHasher,
      rateLimiter: x.rateLimiter,
      publicBaseUrl: BASE,
    });

  it('429s when rate-limited', async () => {
    c.rateLimiter.setBlocked();
    await expect(uc(c).execute({ userId: 'u' })).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('401s for an unknown user', async () => {
    await expect(uc(c).execute({ userId: 'ghost' })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('does nothing when already verified', async () => {
    const u = await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    await c.users.markEmailVerified(u.id, new Date());
    await uc(c).execute({ userId: u.id });
    expect(c.emailSender.sent).toHaveLength(0);
  });

  it('sends a fresh link when unverified', async () => {
    const u = await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    await uc(c).execute({ userId: u.id });
    expect(c.emailSender.sent[0]!.text).toContain(`${BASE}/verify-email?token=`);
  });
});

describe('RequestPasswordReset', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) =>
    new RequestPasswordReset({
      users: x.users,
      oneTimeTokens: x.oneTimeTokens,
      emailSender: x.emailSender,
      random: x.random,
      tokenHasher: x.tokenHasher,
      rateLimiter: x.rateLimiter,
      publicBaseUrl: BASE,
    });

  it('429s when rate-limited', async () => {
    c.rateLimiter.setBlocked();
    await expect(uc(c).execute({ email: 'a@b.co', ip: '1.1.1.1' })).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it('stays silent for an unknown email (no send)', async () => {
    await uc(c).execute({ email: 'ghost@b.co', ip: '1.1.1.1' });
    expect(c.emailSender.sent).toHaveLength(0);
  });

  it('emails a reset link when the account exists', async () => {
    await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    await uc(c).execute({ email: 'a@b.co', ip: '1.1.1.1' });
    expect(c.emailSender.sent[0]!.text).toContain(`${BASE}/reset-password?token=`);
  });
});

describe('ResetPassword', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) =>
    new ResetPassword({
      users: x.users,
      oneTimeTokens: x.oneTimeTokens,
      sessions: x.sessions,
      passwordHasher: x.passwordHasher,
      breachedChecker: x.breachedChecker,
      tokenHasher: x.tokenHasher,
      clock: x.clock,
    });

  it('rejects a breached new password', async () => {
    await expect(uc(c).execute({ token: 't', newPassword: 'password123' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects an invalid token', async () => {
    await expect(
      uc(c).execute({ token: 'bogus', newPassword: 'fresh-secret1' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when the token maps to a missing user', async () => {
    await c.oneTimeTokens.issue('password_reset', 't:tok', 'ghost');
    await expect(
      uc(c).execute({ token: 'tok', newPassword: 'fresh-secret1' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('resets the password, verifies the email, and revokes sessions', async () => {
    const u = await c.users.create({ email: 'a@b.co', passwordHash: 'h:old', displayName: 'A' });
    await c.oneTimeTokens.issue('password_reset', 't:tok', u.id);
    await uc(c).execute({ token: 'tok', newPassword: 'fresh-secret1' });
    const after = await c.users.findById(u.id);
    expect(after!.passwordHash).toBe('h:fresh-secret1');
    expect(after!.emailVerifiedAt).not.toBeNull();
    expect(c.sessions.revokedAll).toContain(u.id);
  });
});

describe('GetMe / UpdateMe', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));

  it('GetMe 401s for a missing user', async () => {
    await expect(new GetMe({ users: c.users }).execute({ userId: 'ghost' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('GetMe returns the public view', async () => {
    const u = await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    const view = await new GetMe({ users: c.users }).execute({ userId: u.id });
    expect(view).toMatchObject({ email: 'a@b.co', role: 'member' });
    expect(view).not.toHaveProperty('passwordHash');
  });

  it('UpdateMe changes the display name', async () => {
    const u = await c.users.create({ email: 'a@b.co', passwordHash: 'x', displayName: 'A' });
    const view = await new UpdateMe({ users: c.users }).execute({
      userId: u.id,
      displayName: 'Renamed',
    });
    expect(view.displayName).toBe('Renamed');
  });
});

describe('ChangePassword', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => (c = ctx()));
  const uc = (x: typeof c) =>
    new ChangePassword({
      users: x.users,
      sessions: x.sessions,
      passwordHasher: x.passwordHasher,
      breachedChecker: x.breachedChecker,
      sessionIssuer: x.sessionIssuer,
    });

  it('401s for a missing user', async () => {
    await expect(
      uc(c).execute({ userId: 'ghost', currentPassword: 'x', newPassword: 'y-longenough' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('403s on a wrong current password', async () => {
    const u = await c.users.create({
      email: 'a@b.co',
      passwordHash: 'h:current-one1',
      displayName: 'A',
    });
    await expect(
      uc(c).execute({ userId: u.id, currentPassword: 'wrong', newPassword: 'new-secret-01' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects a breached new password', async () => {
    const u = await c.users.create({
      email: 'a@b.co',
      passwordHash: 'h:current-one1',
      displayName: 'A',
    });
    await expect(
      uc(c).execute({ userId: u.id, currentPassword: 'current-one1', newPassword: 'password123' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('changes the password, revokes all sessions, and issues a fresh one', async () => {
    const u = await c.users.create({
      email: 'a@b.co',
      passwordHash: 'h:current-one1',
      displayName: 'A',
    });
    const out = await uc(c).execute({
      userId: u.id,
      currentPassword: 'current-one1',
      newPassword: 'new-secret-01',
    });
    expect(c.sessions.revokedAll).toContain(u.id);
    expect(out.accessToken).toMatch(/^jwt:/);
    expect((await c.users.findById(u.id))!.passwordHash).toBe('h:new-secret-01');
  });
});

describe('duplicate-email conflict surfaces from the repo', () => {
  it('throws ConflictError on a duplicate create', async () => {
    const users = new FakeUserRepository([makeUser()]);
    await expect(
      users.create({ email: 'reader@example.com', passwordHash: 'x', displayName: 'B' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
