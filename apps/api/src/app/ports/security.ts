export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** Rejects passwords on a known-breached list (docs/05 §Passwords). */
export interface BreachedPasswordChecker {
  isBreached(password: string): boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — sent as Retry-After on a 429. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Register one attempt against `rl:{scope}:{key}` in a fixed window. Atomic
   * (INCR + first-hit EXPIRE) so concurrent requests can't slip past the limit.
   */
  hit(scope: string, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  /** Clear a counter — e.g. a successful login forgives prior failures. */
  reset(scope: string, key: string): Promise<void>;
}
