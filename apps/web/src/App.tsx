import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { SubjectDetail } from '@bestbooks/shared';
import { catalogueKeys, fetchSubjects } from './features/catalogue/api.js';
import {
  Crumbs,
  ErrorBlock,
  JsonLd,
  LoadingBlock,
  PageMeta,
  PublicLayout,
} from './features/catalogue/components.js';
import { useAuth } from './features/auth/AuthContext.js';
import { fetchTrackedLists, memberKeys } from './features/member/api.js';
import { TrackedListCard } from './features/member/components.js';

/** Returning members see the lists they track (with progress) first (docs/01 F7). */
function HomeTrackedLists() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authenticated' && Boolean(user);
  const { data } = useQuery({
    queryKey: memberKeys.trackedLists,
    queryFn: fetchTrackedLists,
    enabled: isAuthed,
  });

  if (!isAuthed || !data || data.length === 0) return null;

  return (
    <section className="mb-12 rounded-lg border border-line bg-panel p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="eyebrow">Lists you track</h2>
        <Link className="font-sans text-sm text-accent hover:underline" to="/my-books">
          My Books →
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {data.map((list) => (
          <TrackedListCard key={list.slug} list={list} />
        ))}
      </div>
    </section>
  );
}

function SubjectSection({ subject }: { subject: SubjectDetail }) {
  return (
    <section className="border-t border-line py-9 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          <Link className="text-ink hover:text-accent" to={`/subjects/${subject.slug}`}>
            {subject.name}
          </Link>
        </h2>
        <span className="eyebrow whitespace-nowrap">
          {subject.lists.length} {subject.lists.length === 1 ? 'list' : 'lists'}
        </span>
      </div>
      {subject.description ? (
        <p className="mt-2 max-w-2xl text-muted">{subject.description}</p>
      ) : null}
      <ul className="mt-5 grid gap-3">
        {subject.lists.map((list) => (
          <li key={list.slug}>
            <Link
              className="group flex items-baseline gap-3 rounded-md border border-line bg-panel px-4 py-3 transition-colors hover:border-accent"
              to={`/lists/${list.slug}`}
            >
              <span className="font-serif text-lg font-semibold text-ink group-hover:text-accent">
                {list.title}
              </span>
              <span className="font-sans text-xs text-faint">{list.itemCount} books</span>
              {list.intro ? (
                <span className="ml-auto hidden max-w-sm truncate font-sans text-sm text-muted sm:block">
                  {list.intro}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Home: the browse entry point — subjects and their curated lists (docs/04 GET /subjects). */
export function App() {
  const { data, status, error } = useQuery({
    queryKey: catalogueKeys.subjects,
    queryFn: fetchSubjects,
  });

  return (
    <PublicLayout>
      <PageMeta
        title="Best Books Guide — the best books by subject"
        description="A curated, opinionated guide to the best books by subject. An editor picks, ranks, and says why — so you can decide what to read next."
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Best Books Guide',
          description: 'The best books by subject — curated, ranked, and argued.',
        }}
      />
      <Crumbs trail={[{ label: 'Home' }]} />

      <HomeTrackedLists />

      <header className="max-w-2xl">
        <p className="eyebrow">Curated by subject</p>
        <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
          What should you read next?
        </h1>
        <p className="mt-4 text-lg text-muted">
          Most book sites rank by popularity. This one is deliberately curated — each subject
          stripped to the highest-quality, most authoritative books, ranked, with a note on why each
          one earns its place.
        </p>
      </header>

      <div className="mt-12">
        {status === 'pending' ? (
          <LoadingBlock label="Loading subjects…" />
        ) : status === 'error' ? (
          <ErrorBlock error={error} kind="page" />
        ) : data.length === 0 ? (
          <p className="max-w-xl text-muted">
            The first curated lists are being written. Check back soon.
          </p>
        ) : (
          data.map((subject) => <SubjectSection key={subject.slug} subject={subject} />)
        )}
      </div>
    </PublicLayout>
  );
}
