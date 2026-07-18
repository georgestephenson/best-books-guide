import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import type { BookWriteBody } from '@bestbooks/shared';
import { ApiError } from '../../lib/api.js';
import {
  adminKeys,
  createBook,
  deleteBook,
  getAdminBook,
  listSubjects,
  updateBook,
} from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

interface FormState {
  title: string;
  subtitle: string;
  authors: string;
  description: string;
  firstPublishedYear: string;
  pageCount: string;
  isbn13: string;
  language: string;
  subjectIds: string[];
}

const empty: FormState = {
  title: '',
  subtitle: '',
  authors: '',
  description: '',
  firstPublishedYear: '',
  pageCount: '',
  isbn13: '',
  language: 'en',
  subjectIds: [],
};

const labelClass = 'block font-sans text-xs font-semibold uppercase tracking-wide text-faint';
const inputClass = 'mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm';

function toBody(form: FormState): BookWriteBody {
  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    description: form.description.trim() || null,
    isbn13: form.isbn13.trim() || null,
    firstPublishedYear: num(form.firstPublishedYear),
    pageCount: num(form.pageCount),
    language: form.language.trim() || 'en',
    authors: form.authors
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
    subjectIds: form.subjectIds,
  };
}

/** Create or edit a book by hand (docs/01 F6) — the manual fallback to OL import. */
export function BookFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  const subjectsQuery = useQuery({ queryKey: adminKeys.subjects, queryFn: listSubjects });
  const bookQuery = useQuery({
    queryKey: adminKeys.book(id ?? ''),
    queryFn: () => getAdminBook(id!),
    enabled: editing,
  });

  useEffect(() => {
    const b = bookQuery.data;
    if (!b) return;
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? '',
      authors: b.authors.map((a) => a.name).join(', '),
      description: b.description ?? '',
      firstPublishedYear: b.firstPublishedYear?.toString() ?? '',
      pageCount: b.pageCount?.toString() ?? '',
      isbn13: b.isbn13 ?? '',
      language: b.language,
      subjectIds: b.subjectIds,
    });
  }, [bookQuery.data]);

  const save = useMutation({
    mutationFn: () => (editing ? updateBook(id!, toBody(form)) : createBook(toBody(form))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'books'] });
      navigate('/admin');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: () => deleteBook(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'books'] });
      navigate('/admin');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Delete failed'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('A title is required.');
      return;
    }
    save.mutate();
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <AdminLayout>
      <PageMeta title={editing ? 'Edit book — Admin' : 'New book — Admin'} />
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {editing ? 'Edit book' : 'New book'}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 grid max-w-2xl gap-5">
        <FormError message={error} />
        <label>
          <span className={labelClass}>Title</span>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </label>
        <label>
          <span className={labelClass}>Subtitle</span>
          <input
            className={inputClass}
            value={form.subtitle}
            onChange={(e) => set('subtitle', e.target.value)}
          />
        </label>
        <label>
          <span className={labelClass}>Authors (comma-separated)</span>
          <input
            className={inputClass}
            value={form.authors}
            onChange={(e) => set('authors', e.target.value)}
          />
        </label>
        <label>
          <span className={labelClass}>Description</span>
          <textarea
            className={`${inputClass} min-h-32`}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label>
            <span className={labelClass}>Year</span>
            <input
              className={inputClass}
              value={form.firstPublishedYear}
              onChange={(e) => set('firstPublishedYear', e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label>
            <span className={labelClass}>Pages</span>
            <input
              className={inputClass}
              value={form.pageCount}
              onChange={(e) => set('pageCount', e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label>
            <span className={labelClass}>Language</span>
            <input
              className={inputClass}
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>ISBN-13</span>
            <input
              className={inputClass}
              value={form.isbn13}
              onChange={(e) => set('isbn13', e.target.value)}
            />
          </label>
        </div>

        <fieldset>
          <span className={labelClass}>Subjects</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {(subjectsQuery.data ?? []).map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 font-sans text-sm">
                <input
                  type="checkbox"
                  checked={form.subjectIds.includes(s.id)}
                  onChange={(e) =>
                    set(
                      'subjectIds',
                      e.target.checked
                        ? [...form.subjectIds, s.id]
                        : form.subjectIds.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm text-paper hover:bg-accent-soft disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create book'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="font-sans text-sm text-red-700 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      </form>
    </AdminLayout>
  );
}
