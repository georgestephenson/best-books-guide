import type { FastifyReply } from 'fastify';
import { SESSION_TTL_SECONDS } from '../app/auth-constants.js';

/**
 * The refresh cookie (docs/05, [ADR-0005]). Value is `{sessionId}.{secret}` — the
 * session id locates the record, only the secret's hash is stored. `__Host-` is
 * impossible here because the cookie is Path-scoped to the refresh endpoints
 * (`__Host-` forbids a Path other than `/`), so the name is plain.
 */
export const REFRESH_COOKIE_NAME = 'bb_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface ParsedRefresh {
  sessionId: string;
  refreshSecret: string;
}

export function parseRefreshCookie(value: string | undefined): ParsedRefresh | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0 || dot >= value.length - 1) return null;
  return { sessionId: value.slice(0, dot), refreshSecret: value.slice(dot + 1) };
}

function baseOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure, // http in dev, https in prod
    path: REFRESH_COOKIE_PATH,
  } as const;
}

export function setRefreshCookie(
  reply: FastifyReply,
  sessionId: string,
  refreshSecret: string,
  secure: boolean,
): void {
  // maxAge matches the session's absolute lifetime; the server-side TTL is the
  // real authority, this just stops the browser sending a long-dead cookie.
  reply.setCookie(REFRESH_COOKIE_NAME, `${sessionId}.${refreshSecret}`, {
    ...baseOptions(secure),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearRefreshCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, baseOptions(secure));
}
