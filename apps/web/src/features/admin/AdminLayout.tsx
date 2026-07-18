import type { ReactNode } from 'react';
import { Link, Navigate, NavLink } from 'react-router';
import { useAuth } from '../auth/AuthContext.js';

/** Blocks everything under /admin unless the signed-in user is an admin (docs/01). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <p className="mx-auto max-w-4xl px-6 py-10 font-sans text-sm text-muted">Checking access…</p>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="eyebrow mb-2">Not authorised</p>
        <p className="text-muted">This area is for editors only.</p>
        <Link className="mt-4 inline-block font-sans text-sm text-accent hover:underline" to="/">
          ← Back to browse
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `font-sans text-sm ${isActive ? 'text-accent' : 'text-muted hover:text-accent'}`;

/** Shell for the admin area — a distinct top bar so it never reads as the public site. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <RequireAdmin>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
            <span className="font-serif text-lg font-semibold tracking-tight text-ink">
              Best Books Guide
              <span className="ml-2 rounded-sm bg-accent px-1.5 py-0.5 font-sans text-xs text-paper">
                Admin
              </span>
            </span>
            <nav className="flex items-center gap-5">
              <NavLink end to="/admin" className={navClass}>
                Catalogue
              </NavLink>
              <NavLink to="/admin/import" className={navClass}>
                Import
              </NavLink>
              <NavLink to="/admin/subjects" className={navClass}>
                Subjects
              </NavLink>
            </nav>
            <div className="ml-auto flex items-center gap-4 font-sans text-sm text-muted">
              <Link className="hover:text-accent" to="/">
                View site
              </Link>
              <span>{user?.displayName}</span>
              <button type="button" className="hover:text-accent" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
      </div>
    </RequireAdmin>
  );
}

/** A form error surfaced from an ApiError (RFC 9457 detail) or a generic message. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 px-3 py-2 font-sans text-sm text-red-800"
    >
      {message}
    </p>
  );
}
