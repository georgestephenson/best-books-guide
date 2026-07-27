/**
 * Build-time feature flags (Vite inlines `import.meta.env` at build, so flipping one
 * means a redeploy — cheap here, `main` self-deploys in ~48s).
 *
 * Read through a function rather than a module-level const so tests can toggle it with
 * `vi.stubEnv` without re-importing every consumer.
 */

/**
 * Whether to offer accounts to anonymous visitors — a working "Sign in" link in the
 * header and the sign-in prompts on book/list pages.
 *
 * Off in production while SES is stuck in the sandbox: transactional mail only reaches
 * verified identities, so a stranger who signs up gets no verification email (ADR-0011
 * keeps that from 500-ing, but it still leaves them unable to verify). With the flag off
 * the header still shows "Sign in", but it opens a "coming soon" note instead of the
 * signup, and the in-page prompts stay hidden — the public site never invites a signup
 * it cannot complete.
 *
 * The `/login`, `/register` and other auth routes stay registered and fully working, so
 * the editor can still sign in by typing the URL to maintain the catalogue.
 *
 * Remove this flag (and `VITE_AUTH_UI` in `.github/workflows/deploy.yml`) once SES
 * production access lands — tracked in TODO.md.
 */
export function authUiEnabled(): boolean {
  return import.meta.env.VITE_AUTH_UI !== 'false';
}
