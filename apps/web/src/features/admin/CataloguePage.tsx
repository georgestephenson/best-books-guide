import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminKeys, listAdminBooks } from './api.js';
import { AdminLayout } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

/** Admin catalogue home: every book, searchable, with links to edit and to add more. */
export function CataloguePage() {
  const [search, setSearch] = useState('');
  const { data, status } = useQuery({
    queryKey: adminKeys.books(search),
    queryFn: () => listAdminBooks(search || undefined),
  });

  return (
    <AdminLayout>
      <PageMeta title="Catalogue — Admin" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Catalogue</h1>
        <div className="flex gap-2 font-sans text-sm">
          <Link
            to="/admin/import"
            className="rounded-md border border-line px-3 py-1.5 text-ink hover:border-accent"
          >
            Import from Open Library
          </Link>
          <Link
            to="/admin/books/new"
            className="rounded-md bg-accent px-3 py-1.5 text-paper hover:bg-accent-soft"
          >
            New book
          </Link>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search titles…"
        className="mt-6 w-full max-w-sm rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm"
        aria-label="Search catalogue"
      />

      {status === 'pending' ? (
        <p className="mt-6 font-sans text-sm text-muted">Loading…</p>
      ) : status === 'error' ? (
        <p className="mt-6 font-sans text-sm text-muted">Couldn’t load the catalogue.</p>
      ) : data.length === 0 ? (
        <p className="mt-6 text-muted">No books yet. Import one, or add it by hand.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {data.map((book) => (
            <li key={book.id}>
              <Link
                to={`/admin/books/${book.id}`}
                className="flex items-baseline gap-3 py-3 hover:text-accent"
              >
                <span className="font-serif text-lg text-ink">{book.title}</span>
                <span className="font-sans text-sm text-muted">{book.authorNames.join(', ')}</span>
                <span className="ml-auto font-sans text-xs text-faint">/{book.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
