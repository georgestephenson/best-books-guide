/**
 * A port the use-cases depend on instead of reaching for `Date`/`process` directly,
 * so time is injectable and tests are deterministic (docs/02 §clean architecture).
 */
export interface Clock {
  now(): Date;
  /** Seconds since the API process started. */
  uptimeSeconds(): number;
}
