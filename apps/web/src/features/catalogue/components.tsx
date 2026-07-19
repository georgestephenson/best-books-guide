import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../lib/api.js';
import { useAuth } from '../auth/AuthContext.js';

/**
 * React 19 hoists <title>/<meta> to <head> from anywhere in the tree, so each page
 * sets its own document metadata by rendering this ([ADR-0008] keeps the route tree
 * SSR-ready, where the same tags become the server-rendered head).
 */
export function PageMeta({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
    </>
  );
}

/** Inline JSON-LD (schema.org). A non-JS script type, so it's exempt from the CSP. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/** A real cover once imported, else the placeholder (also the graceful coverless state). */
export function Cover({
  title,
  coverUrl,
  series = false,
}: {
  title: string;
  coverUrl?: string | null;
  series?: boolean;
}) {
  if (coverUrl) {
    return <img className="cover-img" src={coverUrl} alt={`Cover of ${title}`} loading="lazy" />;
  }
  return (
    <div className={`cover-ph${series ? ' cover-ph--series' : ''}`} aria-hidden="true">
      <span className="text-[0.6rem]">{title}</span>
    </div>
  );
}

/** Aggregate rating (docs/01 F4) — quiet, one decimal, hidden until there are ratings. */
export function Rating({ avg, count }: { avg: number; count: number }) {
  if (count === 0) {
    return <span className="font-sans text-sm text-faint">Not yet rated</span>;
  }
  const filled = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-2 font-sans text-sm text-muted">
      <span className="stars" aria-hidden="true">
        {'★'.repeat(filled)}
        {'☆'.repeat(5 - filled)}
      </span>
      <span>
        <strong className="text-ink">{avg.toFixed(1)}</strong>
        <span className="text-faint"> · {count} ratings</span>
      </span>
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-accent/20 bg-accent-wash px-2.5 py-0.5 font-sans text-xs text-accent">
      {children}
    </span>
  );
}

/** Breadcrumb trail. Items render as links; the last (current page) is plain text. */
export function Crumbs({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav className="mb-8 font-sans text-sm text-muted" aria-label="Breadcrumb">
      {trail.map((c, i) => (
        <span key={i}>
          {i > 0 ? <span className="px-1.5 text-faint">/</span> : null}
          {c.to ? (
            <Link className="text-muted hover:text-accent" to={c.to}>
              {c.label}
            </Link>
          ) : (
            <span>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * The signed-in reader's name, opening a menu with the account-level actions
 * (Admin, Sign out) — a disclosure so the nav stays uncluttered on mobile.
 * Closes on outside click, Escape, or choosing an item.
 */
function UserMenu({
  displayName,
  isAdmin,
  onSignOut,
}: {
  displayName: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-1 text-muted hover:text-accent"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {displayName}
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 min-w-40 rounded-md border border-line bg-panel py-1 shadow-lg">
          {isAdmin ? (
            <Link
              className="block px-4 py-2 text-muted hover:bg-accent-wash hover:text-accent"
              to="/admin"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          ) : null}
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-muted hover:bg-accent-wash hover:text-accent"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SiteHeader() {
  const { user, status, logout } = useAuth();
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="font-serif text-lg font-semibold tracking-tight text-ink">
          Best Books Guide
        </Link>
        <nav className="flex items-center gap-4 font-sans text-sm">
          {status === 'loading' ? null : user ? (
            <>
              <Link className="text-muted hover:text-accent" to="/my-books">
                My Books
              </Link>
              <UserMenu
                displayName={user.displayName}
                isAdmin={user.role === 'admin'}
                onSignOut={() => void logout()}
              />
            </>
          ) : (
            <Link className="text-accent hover:underline" to="/login">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Shared shell for every public page: header, centred content, quiet footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-4xl px-6 py-6 font-sans text-xs text-faint">
          Best Books Guide — curated, opinionated, reader-supported. No ads, ever.
        </div>
      </footer>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="font-sans text-sm text-muted" role="status">
      {label}
    </p>
  );
}

/** Friendly error, distinguishing a 404 (the common case) from everything else. */
export function ErrorBlock({ error, kind }: { error: unknown; kind: string }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="max-w-xl">
      <p className="eyebrow mb-2">{notFound ? 'Not found' : 'Something went wrong'}</p>
      <p className="text-muted">
        {notFound
          ? `We couldn't find that ${kind}. It may have moved, or never existed.`
          : `We couldn't load this ${kind} just now. Please try again.`}
      </p>
      <Link className="mt-4 inline-block font-sans text-sm text-accent hover:underline" to="/">
        ← Back to browse
      </Link>
    </div>
  );
}
