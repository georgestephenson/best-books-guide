import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fetchHealth } from './lib/api.js';
import { HealthBadge, type HealthBadgeState } from './features/health/HealthBadge.js';
import { useAuth } from './features/auth/AuthContext.js';

/** The home route: the M1 health check plus an auth-aware greeting. */
export function App() {
  const { status: authStatus, user, logout } = useAuth();
  const { data, status } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const badgeState: HealthBadgeState =
    status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'ready';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Best Books Guide 📚</h1>
      <p className="text-slate-600">
        Walking skeleton. The catalogue arrives in M3 — for now this page proves the browser can
        reach the API and hold a session.
      </p>

      {authStatus === 'loading' ? (
        <p className="text-slate-500">Restoring your session…</p>
      ) : user ? (
        <div className="flex items-center gap-3 text-slate-700">
          <span>
            Signed in as <strong>{user.displayName}</strong>
            {user.emailVerifiedAt ? '' : ' (unverified)'}
          </span>
          <button className="underline" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex gap-3 text-slate-700">
          <Link className="underline" to="/login">
            Sign in
          </Link>
          <Link className="underline" to="/register">
            Create an account
          </Link>
        </div>
      )}

      <HealthBadge state={badgeState} health={data} />
    </main>
  );
}
