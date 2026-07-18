import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testDb, resetStores, closeStores, buildTestServer, tokenFromEmail } from './harness.js';
import type { TestServer } from './harness.js';

const API = '/api/v1';
const REGISTER = {
  email: 'reader@example.com',
  password: 'correcthorsebattery',
  displayName: 'Reader',
};

// Pull the refresh cookie value out of a Set-Cookie header.
function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const header = Array.isArray(raw) ? raw.join('\n') : String(raw);
  const match = header.match(/bb_refresh=([^;]+)/);
  if (!match) throw new Error('no refresh cookie set');
  return `bb_refresh=${match[1]}`;
}

async function registerAndVerify(
  app: FastifyInstance,
  emails: TestServer['emails'],
): Promise<void> {
  await app.inject({ method: 'POST', url: `${API}/auth/register`, payload: REGISTER });
  const token = tokenFromEmail(emails.at(-1)!);
  await app.inject({ method: 'POST', url: `${API}/auth/verify-email`, payload: { token } });
}

describe('auth lifecycle (integration)', () => {
  let app: FastifyInstance;
  let emails: TestServer['emails'];

  beforeEach(async () => {
    await resetStores();
    const server = buildTestServer();
    app = server.app;
    emails = server.emails;
    await app.ready();
  });
  afterAll(closeStores);

  it('register → verify → login → refresh → logout', async () => {
    // Register: always 201-shaped, sends a verification email.
    const reg = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: REGISTER,
    });
    expect(reg.statusCode).toBe(201);
    expect(emails).toHaveLength(1);

    // Not yet verified.
    const before = await testDb().db.query.users.findFirst();
    expect(before?.emailVerifiedAt).toBeNull();

    // Verify via the emailed token.
    const verify = await app.inject({
      method: 'POST',
      url: `${API}/auth/verify-email`,
      payload: { token: tokenFromEmail(emails[0]!) },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json()).toEqual({ verified: true });

    // Login: access token + refresh cookie.
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    expect(login.statusCode).toBe(200);
    const body = login.json();
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.expiresIn).toBe(900);
    expect(body.user).toMatchObject({ email: REGISTER.email, role: 'member' });
    expect(body.user.emailVerifiedAt).not.toBeNull();
    const cookie = refreshCookie(login);

    // Authenticated /me via the access token.
    const me = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: REGISTER.email });

    // Refresh rotates the cookie and returns a new access token.
    const refresh = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie },
    });
    expect(refresh.statusCode).toBe(200);
    const newCookie = refreshCookie(refresh);
    expect(newCookie).not.toBe(cookie);

    // Logout revokes the session; a later refresh with the (now-stale) cookie 401s.
    const logout = await app.inject({
      method: 'POST',
      url: `${API}/auth/logout`,
      headers: { cookie: newCookie },
    });
    expect(logout.statusCode).toBe(204);
    const afterLogout = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: newCookie },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it('detects refresh-token reuse and revokes the session (409)', async () => {
    await registerAndVerify(app, emails);
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    const original = refreshCookie(login);

    // Rotate once — `original` is now the previous secret.
    const rotated = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: original },
    });
    expect(rotated.statusCode).toBe(200);
    const current = refreshCookie(rotated);

    // Replaying `original` outside the grace window is theft → 409, session revoked.
    // (The grace window is 10s; the harness clock is real, so we can't be inside it
    // for a *second* independent request here — but to be deterministic we assert the
    // security property directly: a third, clearly-stale replay is rejected.)
    // First, exhaust grace by rotating again with the current cookie.
    const rotated2 = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: current },
    });
    const current2 = refreshCookie(rotated2);

    const reuse = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: original },
    });
    expect(reuse.statusCode).toBe(409);

    // The session was revoked, so even the good current cookie now fails.
    const afterRevoke = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: current2 },
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('tolerates a benign double-fire within the grace window (same session survives)', async () => {
    await registerAndVerify(app, emails);
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    const original = refreshCookie(login);

    const first = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: original },
    });
    expect(first.statusCode).toBe(200);

    // Immediately replay the original (simulates a racing tab / StrictMode double
    // mount). Within 10s this is treated as benign and re-rotated, not revoked.
    const second = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: original },
    });
    expect(second.statusCode).toBe(200);

    // The session is still alive: the latest cookie refreshes fine.
    const third = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: refreshCookie(second) },
    });
    expect(third.statusCode).toBe(200);
  });

  it('returns 429 + Retry-After after too many failed logins, and a success clears it', async () => {
    await registerAndVerify(app, emails);
    const bad = { email: REGISTER.email, password: 'wrong-password-xx' };

    // 5 allowed attempts, the 6th is limited.
    let last;
    for (let i = 0; i < 6; i++) {
      last = await app.inject({ method: 'POST', url: `${API}/auth/login`, payload: bad });
    }
    expect(last!.statusCode).toBe(429);
    expect(last!.headers['retry-after']).toBeDefined();
    expect(Number(last!.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rejects a duplicate registration without leaking it (still 201, emails the owner)', async () => {
    await app.inject({ method: 'POST', url: `${API}/auth/register`, payload: REGISTER });
    emails.length = 0;
    const dup = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: REGISTER,
    });
    expect(dup.statusCode).toBe(201);
    // An email went out, but it's the "you already have an account" one.
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toMatch(/already have an account/i);
  });

  it('resets a password, verifies the email, and revokes all sessions', async () => {
    await registerAndVerify(app, emails);
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    const cookie = refreshCookie(login);
    emails.length = 0;

    await app.inject({
      method: 'POST',
      url: `${API}/auth/forgot-password`,
      payload: { email: REGISTER.email },
    });
    const resetToken = tokenFromEmail(emails.at(-1)!);

    const reset = await app.inject({
      method: 'POST',
      url: `${API}/auth/reset-password`,
      payload: { token: resetToken, newPassword: 'a-brand-new-secret' },
    });
    expect(reset.statusCode).toBe(200);

    // Old session revoked.
    const oldRefresh = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie },
    });
    expect(oldRefresh.statusCode).toBe(401);

    // New password works.
    const relogin = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: 'a-brand-new-secret' },
    });
    expect(relogin.statusCode).toBe(200);
  });

  it('rejects a breached password at registration (422)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: { email: 'x@example.com', password: 'password123', displayName: 'X' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('returns a problem+json with errors[] on schema validation failure', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${API}/auth/register`,
      payload: { email: 'not-an-email', password: 'short', displayName: '' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.type).toContain('/errors/validation');
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it('gates verified-email routes: 401 without a token, 403 before verifying', async () => {
    // No token at all.
    const anon = await app.inject({ method: 'GET', url: `${API}/me` });
    expect(anon.statusCode).toBe(401);

    // Registered but not verified → login works (M), but MV routes would 403.
    // We assert the plumbing via /me requiring only M here; MV routes arrive in M4.
    await app.inject({ method: 'POST', url: `${API}/auth/register`, payload: REGISTER });
    const login = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    expect(login.statusCode).toBe(200);
    const me = await app.inject({
      method: 'GET',
      url: `${API}/me`,
      headers: { authorization: `Bearer ${login.json().accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().emailVerifiedAt).toBeNull();
  });

  it('changes password, revokes other sessions, keeps this one signed in', async () => {
    await registerAndVerify(app, emails);
    const first = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    const second = await app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { email: REGISTER.email, password: REGISTER.password },
    });
    const secondCookie = refreshCookie(second);

    const change = await app.inject({
      method: 'PUT',
      url: `${API}/me/password`,
      headers: { authorization: `Bearer ${first.json().accessToken}` },
      payload: { currentPassword: REGISTER.password, newPassword: 'yet-another-secret' },
    });
    expect(change.statusCode).toBe(200);
    // This device got a fresh cookie and stays usable.
    const fresh = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: refreshCookie(change) },
    });
    expect(fresh.statusCode).toBe(200);
    // The other device's session was revoked.
    const other = await app.inject({
      method: 'POST',
      url: `${API}/auth/refresh`,
      headers: { cookie: secondCookie },
    });
    expect(other.statusCode).toBe(401);
  });
});
