import { createHash, randomBytes } from 'node:crypto';
import type { TokenHasher, RandomSource } from '../../app/ports/token-services.js';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Opaque tokens are stored only as their SHA-256 (docs/05). */
export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): string {
    return sha256Hex(token);
  }
}

export class NodeRandomSource implements RandomSource {
  token(): string {
    return randomBytes(32).toString('base64url');
  }

  sessionId(): string {
    return randomBytes(16).toString('base64url');
  }
}
