import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../../lib/api.js';
import { adminKeys, createList, curationKeys, listAdminLists, listSubjects } from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

/** Index of every list (published + draft) with a form to start a new one. */
export function ListsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lists = useQuery({ queryKey: curationKeys.lists, queryFn: listAdminLists });
  const subjects = useQuery({ queryKey: adminKeys.subjects, queryFn: listSubjects });

  const create = useMutation({
    mutationFn: () => createList({ title, subjectId }),
    onSuccess: (list) => {
      void queryClient.invalidateQueries({ queryKey: curationKeys.lists });
      navigate(`/admin/lists/${list.id}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Could not create'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim() && subjectId) create.mutate();
  }

  return (
    <AdminLayout>
      <PageMeta title="Lists — Admin" />
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Lists</h1>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl flex-wrap gap-2">
        <input
          className="flex-1 rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New list title"
          aria-label="New list title"
        />
        <select
          className="rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          aria-label="Subject"
        >
          <option value="">Subject…</option>
          {(subjects.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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

      {lists.status === 'pending' ? (
        <p className="mt-6 font-sans text-sm text-muted">Loading…</p>
      ) : lists.status === 'error' ? (
        <p className="mt-6 font-sans text-sm text-muted">Couldn’t load lists.</p>
      ) : lists.data.length === 0 ? (
        <p className="mt-6 text-muted">No lists yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {lists.data.map((list) => (
            <li key={list.id}>
              <Link
                to={`/admin/lists/${list.id}`}
                className="flex items-baseline gap-3 py-3 hover:text-accent"
              >
                <span className="font-serif text-lg text-ink">{list.title}</span>
                {list.parentTitle ? (
                  <span className="font-sans text-xs text-faint">↳ {list.parentTitle}</span>
                ) : null}
                <span className="font-sans text-sm text-muted">{list.subjectName}</span>
                <span className="ml-auto flex items-center gap-3 font-sans text-xs text-faint">
                  <span>{list.itemCount} items</span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      list.isPublished ? 'bg-accent-wash text-accent' : 'bg-line text-muted'
                    }`}
                  >
                    {list.isPublished ? 'Published' : 'Draft'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
