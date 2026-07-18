import { SignJWT, jwtVerify } from 'jose';
import type { AccessTokenClaims, AccessTokenService } from '../../app/ports/token-services.js';
import type { Role } from '../../app/ports/user-repository.js';

export interface JoseAccessTokenOptions {
  secret: string;
  /** Set during a rotation window: still accepted for verify (docs/07). */
  previousSecret?: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
}

/**
 * HS256 access tokens via `jose` (docs/05, [ADR-0005]). jose sits behind this port
 * rather than `@fastify/jwt` so signing/verification stays in `infra/` and never
 * pulls Fastify into the app layer (ADR-0003). The dual-key verify makes the
 * secret-rotation window trivial: sign with the current key, accept either.
 */
export class JoseAccessTokenService implements AccessTokenService {
  readonly ttlSeconds: number;
  private readonly encoder = new TextEncoder();
  private readonly keys: Uint8Array[];

  constructor(private readonly opts: JoseAccessTokenOptions) {
    this.ttlSeconds = opts.ttlSeconds;
    this.keys = [this.encoder.encode(opts.secret)];
    if (opts.previousSecret) {
      this.keys.push(this.encoder.encode(opts.previousSecret));
    }
  }

  sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ role: claims.role, sid: claims.sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuer(this.opts.issuer)
      .setAudience(this.opts.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.keys[0]!);
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    for (const key of this.keys) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: this.opts.issuer,
          audience: this.opts.audience,
        });
        const role = payload.role;
        if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
        if (role !== 'member' && role !== 'admin') return null;
        return { sub: payload.sub, role: role as Role, sid: payload.sid };
      } catch {
        // Signature/exp/iss/aud failure — try the previous key, then give up.
      }
    }
    return null;
  }
}
