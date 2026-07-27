import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { NotFoundPage } from './NotFoundPage.js';
import { PageMeta, PublicLayout } from './components.js';

/**
 * The router's `errorElement` (routes.tsx): what a visitor sees when a page throws
 * rather than fails a fetch — a bad lazy chunk after a deploy, a render bug, a
 * loader crash. Nginx's static 50x.html covers the case where the app can't even
 * boot; this is the same calm treatment once React is running.
 *
 * A thrown 404 response (nothing does today, but a loader could) is still a 404 to
 * the reader, so it renders the not-found page instead of "something went wrong".
 */
export function ErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  // Surfaced for the editor's own debugging (and any bug report) — the browser
  // console has the stack; the page stays plain prose.
  const detail =
    error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : null;

  return (
    <PublicLayout>
      <PageMeta title="Something went wrong — Best Books Guide" noIndex />
      <div className="max-w-xl py-10">
        <p className="eyebrow">Error</p>
        <h1 className="mt-2 text-balance font-serif text-4xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-4 text-muted">
          This page broke on the way to your screen — our fault, not yours. Reloading usually fixes
          it; if it doesn&rsquo;t, browsing from the start will.
        </p>
        {detail ? <p className="mt-4 font-sans text-xs text-faint">{detail}</p> : null}
        <div className="mt-6 flex items-center gap-5">
          <button
            type="button"
            className="font-sans text-sm text-accent hover:underline"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
          <Link className="font-sans text-sm text-accent hover:underline" to="/">
            ← Back to browse
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
