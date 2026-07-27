/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * `'false'` hides the account entry points from anonymous visitors; anything else
   * (including unset, the dev/test default) shows them. See `lib/featureFlags.ts`.
   */
  readonly VITE_AUTH_UI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
