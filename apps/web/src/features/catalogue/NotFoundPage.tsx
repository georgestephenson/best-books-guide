import { Link } from 'react-router';
import { PageMeta, PublicLayout } from './components.js';

/** Catch-all for unmatched routes — a calm 404 instead of the router's dev error. */
export function NotFoundPage() {
  return (
    <PublicLayout>
      <PageMeta title="Not found — Best Books Guide" />
      <div className="max-w-xl py-10">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-balance font-serif text-4xl font-semibold tracking-tight">
          This page doesn’t exist
        </h1>
        <p className="mt-4 text-muted">
          The page you’re after may have moved, or never existed. Try browsing from the start.
        </p>
        <Link className="mt-6 inline-block font-sans text-sm text-accent hover:underline" to="/">
          ← Back to browse
        </Link>
      </div>
    </PublicLayout>
  );
}
