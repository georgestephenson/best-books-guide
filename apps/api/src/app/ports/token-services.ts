import type { Role } from './user-repository.js';

/** SHA-256 (or equivalent) hashing of opaque tokens before they touch Redis. */
export interface TokenHasher {
  hash(token: string): string;
}

/** Cryptographically-strong random material. */
export interface RandomSource {
  /** 256-bit base64url — refresh secrets and email tokens. */
  token(): string;
  /** 128-bit base64url — session ids. */
  sessionId(): string;
}

/** Claims carried by the short-lived access JWT (docs/05). */
export interface AccessTokenClaims {
  sub: string;
  role: Role;
  sid: string;
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): Promise<string>;
  /** Verify signature/iss/aud/exp; returns the claims or null if invalid/expired. */
  verify(token: string): Promise<AccessTokenClaims | null>;
  /** Access-token lifetime, surfaced to the client as `expiresIn`. */
  readonly ttlSeconds: number;
}

/** One-time email tokens: verification (24h) and password reset (1h) (docs/03). */
export type OneTimeTokenPurpose = 'verify_email' | 'password_reset';

export interface OneTimeTokenStore {
  /** Store `tokenHash → userId` with a TTL. */
  issue(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void>;
  /** Atomically fetch-and-delete (single-use); returns the userId or null. */
  consume(purpose: OneTimeTokenPurpose, tokenHash: string): Promise<string | null>;
}
