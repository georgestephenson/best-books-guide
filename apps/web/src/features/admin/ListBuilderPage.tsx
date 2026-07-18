import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import type { AdminListItem } from '@bestbooks/shared';
import { ApiError } from '../../lib/api.js';
import {
  adminKeys,
  curationKeys,
  deleteList,
  getAdminList,
  listAdminBooks,
  listAdminLists,
  listAdminSeries,
  listSubjects,
  setListItems,
  updateList,
} from './api.js';
import { AdminLayout, FormError } from './AdminLayout.js';
import { PageMeta } from '../catalogue/components.js';

const inputClass = 'w-full rounded-md border border-line bg-panel px-3 py-2 font-sans text-sm';
const labelClass = 'block font-sans text-xs font-semibold uppercase tracking-wide text-faint';

type Item = Pick<AdminListItem, 'type' | 'refId' | 'title' | 'blurb'>;

/** Build a list: metadata, sublist nesting, publish, and ranked items with blurbs. */
export function ListBuilderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [intro, setIntro] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [parentListId, setParentListId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [pick, setPick] = useState('');

  const list = useQuery({ queryKey: curationKeys.list(id), queryFn: () => getAdminList(id) });
  const subjects = useQuery({ queryKey: adminKeys.subjects, queryFn: listSubjects });
  const books = useQuery({ queryKey: adminKeys.books(''), queryFn: () => listAdminBooks() });
  const allSeries = useQuery({ queryKey: curationKeys.series, queryFn: listAdminSeries });
  const lists = useQuery({ queryKey: curationKeys.lists, queryFn: listAdminLists });

  useEffect(() => {
    const l = list.data;
    if (!l) return;
    setTitle(l.title);
    setSubjectId(l.subjectId);
    setIntro(l.intro ?? '');
    setIsPublished(l.isPublished);
    setParentListId(l.parentListId ?? '');
    setItems(
      l.items.map((i) => ({ type: i.type, refId: i.refId, title: i.title, blurb: i.blurb })),
    );
  }, [list.data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateList(id, {
        title,
        subjectId,
        intro: intro.trim() || null,
        isPublished,
        parentListId: parentListId || null,
      });
      await setListItems(id, {
        items: items.map((i) =>
          i.type === 'book'
            ? { bookId: i.refId, blurb: i.blurb }
            : { seriesId: i.refId, blurb: i.blurb },
        ),
      });
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: curationKeys.lists });
      void queryClient.invalidateQueries({ queryKey: curationKeys.list(id) });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: () => deleteList(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: curationKeys.lists });
      navigate('/admin/lists');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? (err.problem?.detail ?? err.message) : 'Delete failed'),
  });

  function addPicked() {
    if (!pick) return;
    const [kind, refId] = pick.split(':');
    if (items.some((i) => i.refId === refId)) return;
    const title_ =
      kind === 'book'
        ? (books.data?.find((b) => b.id === refId)?.title ?? '')
        : (allSeries.data?.find((s) => s.id === refId)?.title ?? '');
    setItems([
      ...items,
      { type: kind as 'book' | 'series', refId: refId!, title: title_, blurb: null },
    ]);
    setPick('');
  }
  function moveItem(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  }

  // Eligible parents: top-level lists in the same subject, excluding this one.
  const subjectName = subjects.data?.find((s) => s.id === subjectId)?.name;
  const parentOptions = (lists.data ?? []).filter(
    (l) => l.id !== id && l.parentTitle === null && l.subjectName === subjectName,
  );

  if (list.status === 'error') {
    return (
      <AdminLayout>
        <p className="text-muted">Couldn’t load that list.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageMeta title={`${title || 'List'} — Admin`} />
      <div className="grid max-w-2xl gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Edit list</h1>
          {list.data ? (
            <a
              className="font-sans text-sm text-accent hover:underline"
              href={`/lists/${list.data.slug}`}
            >
              /lists/{list.data.slug}
            </a>
          ) : null}
        </div>
        <FormError message={error} />

        <label>
          <span className={labelClass}>Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className={labelClass}>Subject</span>
            <select
              className={inputClass}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {(subjects.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Parent list (sublist)</span>
            <select
              className={inputClass}
              value={parentListId}
              onChange={(e) => setParentListId(e.target.value)}
            >
              <option value="">— none (top level) —</option>
              {parentOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className={labelClass}>Intro (selection criteria)</span>
          <textarea
            className={`${inputClass} min-h-24`}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Published
        </label>

        <div>
          <span className={labelClass}>Items (ranked)</span>
          <ol className="mt-2 divide-y divide-line border-y border-line">
            {items.map((item, i) => (
              <li key={item.refId} className="flex flex-wrap items-center gap-2 py-3">
                <span className="font-serif tabular-nums text-accent">{i + 1}</span>
                <span className="font-serif text-ink">
                  {item.title}
                  {item.type === 'series' ? (
                    <span className="ml-1 font-sans text-[0.6rem] uppercase tracking-wide text-faint">
                      series
                    </span>
                  ) : null}
                </span>
                <input
                  className="ml-2 min-w-40 flex-1 rounded-md border border-line bg-panel px-2 py-1 font-sans text-xs"
                  placeholder="Blurb — why it's here"
                  value={item.blurb ?? ''}
                  onChange={(e) =>
                    setItems(items.map((x, j) => (j === i ? { ...x, blurb: e.target.value } : x)))
                  }
                />
                <span className="flex gap-2 font-sans text-sm">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => moveItem(i, -1)}
                    className="text-muted hover:text-accent disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => moveItem(i, 1)}
                    className="text-muted hover:text-accent disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
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
              aria-label="Add item"
            >
              <option value="">Add a book or series…</option>
              <optgroup label="Books">
                {(books.data ?? []).map((b) => (
                  <option key={b.id} value={`book:${b.id}`}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Series">
                {(allSeries.data ?? []).map((s) => (
                  <option key={s.id} value={`series:${s.id}`}>
                    {s.title}
                  </option>
                ))}
              </optgroup>
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
            {save.isPending ? 'Saving…' : 'Save list'}
          </button>
          {saved ? <span className="font-sans text-sm text-accent">Saved ✓</span> : null}
          <button
            type="button"
            onClick={() => remove.mutate()}
            className="ml-auto font-sans text-sm text-red-700 hover:underline"
          >
            Delete list
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
