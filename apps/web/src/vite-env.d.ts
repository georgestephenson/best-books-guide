/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * `'false'` closes the account entry points to anonymous visitors — the header
   * "Sign in" turns into a "coming soon" note and the in-page prompts go quiet; anything
   * else (including unset, the dev/test default) opens them. See `lib/featureFlags.ts`.
   */
  readonly VITE_AUTH_UI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
