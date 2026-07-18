/**
 * Refresh-token session (docs/03 Redis keyspace, docs/05). One record per login,
 * keyed by a stable session id; the refresh secret is rotated in place and only its
 * SHA-256 is ever stored. `prevTokenHash` + `rotatedAt` power reuse detection and
 * the double-fire grace window ([ADR-0009]).
 */
export interface SessionRecord {
  userId: string;
  tokenHash: string;
  /** The hash rotated away from on the last refresh; null on a fresh login. */
  prevTokenHash: string | null;
  /** Epoch ms of the last rotation — the grace window measures from here. */
  rotatedAt: number;
  /** Epoch ms of the absolute 30-day expiry; the Redis TTL matches and is never extended. */
  expiresAt: number;
}

export interface SessionStore {
  /** Store a new session (TTL from expiresAt) and index it under the user. */
  create(sessionId: string, record: SessionRecord): Promise<void>;
  get(sessionId: string): Promise<SessionRecord | null>;
  /** Update the token hashes in place, preserving the absolute-expiry TTL. */
  rotate(
    sessionId: string,
    fields: { tokenHash: string; prevTokenHash: string; rotatedAt: number },
  ): Promise<void>;
  /** Revoke a single session (logout, or reuse detected). */
  revoke(sessionId: string, userId: string): Promise<void>;
  /** Revoke every session for a user (password change/reset — "log out everywhere"). */
  revokeAllForUser(userId: string): Promise<void>;
}
