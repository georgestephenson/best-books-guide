import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminSubject } from '@bestbooks/shared';
import { ApiError } from '../../lib/api.js';
import {
  adminKeys,
  createSubject,
  deleteSubject,
  listSubjects,
  reorderSubjects,
  updateSubject,
} from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

const inputClass = 'rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm';

function SubjectRow({
  subject,
  onError,
  onMoveUp,
  onMoveDown,
}: {
  subject: AdminSubject;
  onError: (msg: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [description, setDescription] = useState(subject.description ?? '');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
  const asError = (err: unknown) =>
    onError(
      err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Something went wrong',
    );

  const save = useMutation({
    mutationFn: () => updateSubject(subject.id, { name, description: description || null }),
    onSuccess: () => {
      setEditing(false);
      void invalidate();
    },
    onError: asError,
  });
  const remove = useMutation({
    mutationFn: () => deleteSubject(subject.id),
    onSuccess: invalidate,
    onError: asError,
  });

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-3">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className={`${inputClass} flex-1`}
          value={description}
          placeholder="Description"
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          onClick={() => save.mutate()}
          className="font-sans text-sm text-accent hover:underline"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="font-sans text-sm text-muted hover:underline"
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-baseline gap-3 py-3">
      <span className="font-serif text-lg text-ink">{subject.name}</span>
      {subject.description ? (
        <span className="font-sans text-sm text-muted">{subject.description}</span>
      ) : null}
      <span className="ml-auto flex gap-3 font-sans text-sm">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!onMoveUp}
          aria-label={`Move ${subject.name} up`}
          className="text-muted hover:text-accent disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!onMoveDown}
          aria-label={`Move ${subject.name} down`}
          className="text-muted hover:text-accent disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted hover:text-accent"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => remove.mutate()}
          className="text-red-700 hover:underline"
        >
          Delete
        </button>
      </span>
    </li>
  );
}

/** Manage subjects — the top-level browse axis (docs/03). CRUD; reorder is drag-free. */
export function SubjectsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data, status } = useQuery({ queryKey: adminKeys.subjects, queryFn: listSubjects });

  const add = useMutation({
    mutationFn: () => createSubject({ name }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Could not add'),
  });

  const reorder = useMutation({
    mutationFn: reorderSubjects,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.subjects }),
    onError: (err) =>
      setError(
        err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Could not reorder',
      ),
  });

  // Swap a subject with its neighbour and persist the whole new order.
  function move(index: number, direction: -1 | 1) {
    if (!data) return;
    const ids = data.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim()) add.mutate();
  }

  return (
    <AdminLayout>
      <PageMeta title="Subjects — Admin" />
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Subjects</h1>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-md gap-2">
        <input
          className={`${inputClass} flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New subject name"
          aria-label="New subject name"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-sans text-sm text-paper hover:bg-accent-soft"
        >
          Add
        </button>
      </form>
      <div className="mt-3">
        <FormError message={error} />
      </div>

      {status === 'pending' ? (
        <p className="mt-6 font-sans text-sm text-muted">Loading…</p>
      ) : status === 'error' ? (
        <p className="mt-6 font-sans text-sm text-muted">Couldn’t load subjects.</p>
      ) : data.length === 0 ? (
        <p className="mt-6 text-muted">No subjects yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {data.map((s, i) => (
            <SubjectRow
              key={s.id}
              subject={s}
              onError={setError}
              onMoveUp={i > 0 ? () => move(i, -1) : undefined}
              onMoveDown={i < data.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
