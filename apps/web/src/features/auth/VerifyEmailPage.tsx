import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from './AuthContext.js';
import { verifyEmailRequest } from './api.js';
import { AuthCard, errorMessage } from './components.js';

type Status = 'verifying' | 'ok' | 'error';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { status: authStatus, reloadUser } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  // The link opens exactly one verification; guard against StrictMode double-run.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    void (async () => {
      try {
        await verifyEmailRequest(token);
        setStatus('ok');
        // If this browser is signed in, refresh the profile so the verified flag shows.
        if (authStatus === 'authenticated') await reloadUser();
      } catch (err) {
        setStatus('error');
        setMessage(errorMessage(err));
      }
    })();
  }, [token, authStatus, reloadUser]);

  if (status === 'verifying') {
    return (
      <AuthCard title="Confirming your email">
        <p className="text-sm text-slate-600">One moment…</p>
      </AuthCard>
    );
  }

  if (status === 'ok') {
    return (
      <AuthCard title="Email confirmed">
        <p className="text-sm text-slate-600">
          Your email is verified. You can now rate and review.
        </p>
        <p className="text-sm text-slate-600">
          <Link className="underline" to="/">
            Go home
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Couldn’t confirm your email">
      <p role="alert" className="text-sm font-medium text-red-600">
        {message}
      </p>
      <p className="text-sm text-slate-600">
        <Link className="underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
