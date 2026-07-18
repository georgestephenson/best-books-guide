import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../../lib/api.js';
import { createSeries, curationKeys, listAdminSeries } from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

/** Index of series with a form to create one; each links to its builder. */
export function SeriesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const series = useQuery({ queryKey: curationKeys.series, queryFn: listAdminSeries });

  const create = useMutation({
    mutationFn: () => createSeries({ title }),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: curationKeys.series });
      navigate(`/admin/series/${s.id}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Could not create'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim()) create.mutate();
  }

  return (
    <AdminLayout>
      <PageMeta title="Series — Admin" />
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Series</h1>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-md gap-2">
        <input
          className="flex-1 rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New series title"
          aria-label="New series title"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-sans text-sm text-paper hover:bg-accent-soft"
        >
          Create
        </button>
      </form>
      <div className="mt-3">
        <FormError message={error} />
      </div>

      {series.status === 'pending' ? (
        <p className="mt-6 font-sans text-sm text-muted">Loading…</p>
      ) : series.status === 'error' ? (
        <p className="mt-6 font-sans text-sm text-muted">Couldn’t load series.</p>
      ) : series.data.length === 0 ? (
        <p className="mt-6 text-muted">No series yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {series.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/admin/series/${s.id}`}
                className="flex items-baseline gap-3 py-3 hover:text-accent"
              >
                <span className="font-serif text-lg text-ink">{s.title}</span>
                <span className="ml-auto font-sans text-xs text-faint">{s.bookCount} books</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
