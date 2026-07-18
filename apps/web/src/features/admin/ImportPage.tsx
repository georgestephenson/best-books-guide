import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { OpenLibraryResult } from '@bestbooks/shared';
import { ApiError } from '../../lib/api.js';
import { importBook, olSearch } from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

function ResultRow({
  doc,
  onImported,
}: {
  doc: OpenLibraryResult;
  onImported: (slug: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [importedSlug, setImportedSlug] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => importBook(doc.workKey),
    onSuccess: (book) => {
      setImportedSlug(book.slug);
      onImported(book.slug);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Import failed'),
  });

  return (
    <li className="flex items-baseline gap-3 py-3">
      <div className="min-w-0 flex-1">
        <span className="font-serif text-lg text-ink">{doc.title}</span>{' '}
        <span className="font-sans text-sm text-muted">
          {doc.authorNames.join(', ')}
          {doc.firstPublishYear ? ` · ${doc.firstPublishYear}` : ''}
        </span>
        {error ? <div className="mt-1 font-sans text-xs text-red-700">{error}</div> : null}
      </div>
      {importedSlug ? (
        <Link
          className="font-sans text-sm text-accent hover:underline"
          to={`/books/${importedSlug}`}
        >
          Imported ✓
        </Link>
      ) : (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-md border border-line px-3 py-1 font-sans text-sm text-ink hover:border-accent disabled:opacity-50"
        >
          {mutation.isPending ? 'Importing…' : 'Import'}
        </button>
      )}
    </li>
  );
}

/** Search Open Library and import a work in one click (docs/01 F6). */
export function ImportPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const queryClient = useQueryClient();
  const { data, status, error, fetchStatus } = useQuery({
    queryKey: ['ol-search', submitted],
    queryFn: () => olSearch(submitted),
    enabled: submitted.length > 0,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <AdminLayout>
      <PageMeta title="Import — Admin" />
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Import from Open Library</h1>
      <p className="mt-2 font-sans text-sm text-muted">
        Search, then import a work with its cover in one click. Everything is editable afterward.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-lg gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title, author, ISBN…"
          aria-label="Search Open Library"
          className="flex-1 rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-sans text-sm text-paper hover:bg-accent-soft"
        >
          Search
        </button>
      </form>

      {submitted && (status === 'pending' || fetchStatus === 'fetching') ? (
        <p className="mt-6 font-sans text-sm text-muted">Searching…</p>
      ) : status === 'error' ? (
        <FormError message={error instanceof ApiError ? error.message : 'Search failed'} />
      ) : data && data.length > 0 ? (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {data.map((doc) => (
            <ResultRow
              key={doc.workKey}
              doc={doc}
              onImported={() =>
                void queryClient.invalidateQueries({ queryKey: ['admin', 'books'] })
              }
            />
          ))}
        </ul>
      ) : submitted && data ? (
        <p className="mt-6 text-muted">No results for “{submitted}”.</p>
      ) : null}
    </AdminLayout>
  );
}
