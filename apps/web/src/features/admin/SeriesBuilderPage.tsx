import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '../../lib/api.js';
import {
  adminKeys,
  curationKeys,
  deleteSeries,
  getAdminSeries,
  listAdminBooks,
  setSeriesBooks,
  updateSeries,
} from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

const inputClass = 'w-full rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm';
const labelClass = 'block font-sans text-xs font-semibold uppercase tracking-wide text-faint';

/** Build a series: title, description, and its member books in reading order. */
export function SeriesBuilderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [books, setBooks] = useState<{ id: string; title: string }[]>([]);
  const [pick, setPick] = useState('');

  const series = useQuery({
    queryKey: curationKeys.seriesItem(id),
    queryFn: () => getAdminSeries(id),
  });
  const allBooks = useQuery({ queryKey: adminKeys.books(''), queryFn: () => listAdminBooks() });

  useEffect(() => {
    const s = series.data;
    if (!s) return;
    setTitle(s.title);
    setDescription(s.description ?? '');
    setBooks(s.books.map((b) => ({ id: b.id, title: b.title })));
  }, [series.data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateSeries(id, { title, description: description.trim() || null });
      await setSeriesBooks(id, { bookIds: books.map((b) => b.id) });
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: curationKeys.series });
      void queryClient.invalidateQueries({ queryKey: curationKeys.seriesItem(id) });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: () => deleteSeries(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: curationKeys.series });
      navigate('/admin/series');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Delete failed'),
  });

  function addPicked() {
    if (!pick || books.some((b) => b.id === pick)) return;
    const title_ = allBooks.data?.find((b) => b.id === pick)?.title ?? '';
    setBooks([...books, { id: pick, title: title_ }]);
    setPick('');
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...books];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setBooks(next);
  }

  return (
    <AdminLayout>
      <PageMeta title={`${title || 'Series'} — Admin`} />
      <div className="grid max-w-2xl gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Edit series</h1>
          {series.data ? (
            <a
              className="font-sans text-sm text-accent hover:underline"
              href={`/series/${series.data.slug}`}
            >
              /series/{series.data.slug}
            </a>
          ) : null}
        </div>
        <FormError message={error} />

        <label>
          <span className={labelClass}>Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span className={labelClass}>Description</span>
          <textarea
            className={`${inputClass} min-h-24`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div>
          <span className={labelClass}>Books (reading order)</span>
          <ol className="mt-2 divide-y divide-line border-y border-line">
            {books.map((book, i) => (
              <li key={book.id} className="flex items-center gap-2 py-3">
                <span className="font-serif tabular-nums text-accent">{i + 1}</span>
                <span className="font-serif text-ink">{book.title}</span>
                <span className="ml-auto flex gap-2 font-sans text-sm">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="text-muted hover:text-accent disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === books.length - 1}
                    onClick={() => move(i, 1)}
                    className="text-muted hover:text-accent disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setBooks(books.filter((_, j) => j !== i))}
                    className="text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <select
              className={inputClass}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label="Add book"
            >
              <option value="">Add a book…</option>
              {(allBooks.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addPicked}
              className="rounded-md border border-line px-3 py-2 font-sans text-sm text-ink hover:border-accent"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSaved(false);
              save.mutate();
            }}
            disabled={save.isPending}
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm text-paper hover:bg-accent-soft disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save series'}
          </button>
          {saved ? <span className="font-sans text-sm text-accent">Saved ✓</span> : null}
          <button
            type="button"
            onClick={() => remove.mutate()}
            className="ml-auto font-sans text-sm text-red-700 hover:underline"
          >
            Delete series
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
