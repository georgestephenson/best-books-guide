import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import { AuthProvider } from '../features/auth/AuthContext.js';
import { setSessionHint } from '../lib/authToken.js';

/** Render a component inside the app's providers (query + auth + router) for tests. */
export function renderApp(ui: ReactNode, { route = '/' }: { route?: string } = {}) {
  // Boot as a returning visitor: prime the session hint so AuthProvider attempts the
  // mount-time refresh (AuthProvider skips it without the hint — the F2 401-avoidance
  // for anonymous devices). The mocked POST /auth/refresh then decides the outcome:
  // the default handler 401s → anonymous; a `signedIn()` override → authenticated.
  setSessionHint(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
