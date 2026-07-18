import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../../app/ports/security.js';

// Algorithm.Argon2id is a const enum, which can't be imported as a value under
// isolatedModules — its numeric value is 2 (Argon2d=0, Argon2i=1, Argon2id=2).
const ARGON2ID = 2;

// OWASP-recommended params (docs/05 §Passwords): m=19 MiB, t=2, p=1.
// memoryCost is in KiB, so 19 MiB = 19 * 1024.
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * @node-rs/argon2 (napi-rs), not the `argon2` npm package: it ships reliable
 * linux-arm64 prebuilds, so the Graviton release build never compiles from source.
 * The port keeps this swappable ([ADR-0005] "one auth module").
 */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(hashed: string, password: string): Promise<boolean> {
    try {
      // Params are encoded in the hash string; verify reads them from there.
      return await verify(hashed, password);
    } catch {
      // A malformed hash (e.g. the login dummy) must read as "wrong password".
      return false;
    }
  }
}
