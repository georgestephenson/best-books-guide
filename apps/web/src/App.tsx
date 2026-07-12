import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './lib/api.js';
import { HealthBadge, type HealthBadgeState } from './features/health/HealthBadge.js';

export function App() {
  const { data, status } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const badgeState: HealthBadgeState =
    status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'ready';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Best Books Guide 📚</h1>
      <p className="text-slate-600">
        Walking skeleton. The catalogue arrives in M3 — for now this page just proves the browser
        can reach the API through the shared contract.
      </p>
      <HealthBadge state={badgeState} health={data} />
    </main>
  );
}
