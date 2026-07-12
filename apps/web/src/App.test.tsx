import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.js';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the API health once it loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'ok', version: 'test', uptimeSeconds: 3 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    renderApp();
    expect(await screen.findByText(/api ok · test · up 3s/i)).toBeInTheDocument();
  });

  it('shows an error when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    renderApp();
    expect(await screen.findByText(/api unreachable/i)).toBeInTheDocument();
  });
});
