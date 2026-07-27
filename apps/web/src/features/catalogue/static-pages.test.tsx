import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '../auth/AuthContext.js';
import { ErrorPage } from './ErrorPage.js';

/**
 * The error page needs a *data* router (it reads `useRouteError`), so these tests
 * mount one directly rather than going through `renderApp`'s MemoryRouter. No
 * session hint is primed, so AuthProvider settles anonymous without a refresh call.
 */
function renderWithDataRouter(routes: Parameters<typeof createMemoryRouter>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes);
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function robotsMeta() {
  return document.head.querySelector('meta[name="robots"]');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks(); // the reload test stubs window.location
});

describe('ErrorPage', () => {
  function throwingRoute(thrown: unknown) {
    return [
      {
        path: '/',
        element: null,
        loader: () => {
          throw thrown;
        },
        errorElement: <ErrorPage />,
      },
    ];
  }

  it('catches a thrown render error with a calm page, a reload and a way back', async () => {
    renderWithDataRouter(throwingRoute(new Error('chunk 42 failed to load')));

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to browse/i })).toHaveAttribute('href', '/');
    // The message helps a bug report; the stack stays in the console.
    expect(screen.getByText(/chunk 42 failed to load/)).toBeInTheDocument();
  });

  it('keeps error pages out of the index (the SPA fallback answers 200)', async () => {
    renderWithDataRouter(throwingRoute(new Error('boom')));

    await screen.findByRole('heading', { name: /something went wrong/i, level: 1 });
    expect(robotsMeta()).toHaveAttribute('content', 'noindex');
  });

  it('reloads the page on request', async () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      reload,
    } as unknown as Location);
    renderWithDataRouter(throwingRoute(new Error('boom')));

    await userEvent.click(await screen.findByRole('button', { name: /reload the page/i }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('falls back to the status text when a non-404 response is thrown', async () => {
    renderWithDataRouter(
      throwingRoute(new Response(null, { status: 503, statusText: 'Rebuilding' })),
    );

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Rebuilding')).toBeInTheDocument();
  });

  it('renders the 404 page when a route throws a 404 response', async () => {
    renderWithDataRouter(throwingRoute(new Response(null, { status: 404 })));

    expect(
      await screen.findByRole('heading', { name: /doesn.t exist/i, level: 1 }),
    ).toBeInTheDocument();
  });
});
