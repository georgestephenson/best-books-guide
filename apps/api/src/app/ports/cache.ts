/**
 * Tiny string cache over Redis (docs/03 §Redis keyspace) — used to memoise Open
 * Library search responses for a few minutes so repeated admin queries don't hammer
 * the upstream. Cache misses are cheap; losing Redis just means a cold fetch.
 */
export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}
