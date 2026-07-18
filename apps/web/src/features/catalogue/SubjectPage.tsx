import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { catalogueKeys, fetchSubject } from './api.js';
import { Crumbs, ErrorBlock, JsonLd, LoadingBlock, PageMeta, PublicLayout } from './components.js';

/** A subject and its published lists (docs/04 GET /subjects/{slug}). */
export function SubjectPage() {
  const { slug = '' } = useParams();
  const { data, status, error } = useQuery({
    queryKey: catalogueKeys.subject(slug),
    queryFn: () => fetchSubject(slug),
  });

  return (
    <PublicLayout>
      {status === 'pending' ? (
        <LoadingBlock label="Loading subject…" />
      ) : status === 'error' ? (
        <ErrorBlock error={error} kind="subject" />
      ) : (
        <>
          <PageMeta
            title={`${data.name} — Best Books Guide`}
            description={data.description ?? `Curated lists of the best ${data.name} books.`}
          />
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: data.name,
              description: data.description ?? undefined,
            }}
          />
          <Crumbs trail={[{ label: 'Home', to: '/' }, { label: data.name }]} />

          <header className="max-w-2xl">
            <p className="eyebrow">Subject</p>
            <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
              {data.name}
            </h1>
            {data.description ? (
              <p className="mt-4 text-lg text-muted">{data.description}</p>
            ) : null}
          </header>

          {data.lists.length === 0 ? (
            <p className="mt-10 text-muted">No published lists here yet.</p>
          ) : (
            <ul className="mt-10 grid gap-3">
              {data.lists.map((list) => (
                <li key={list.slug}>
                  <Link
                    className="group flex flex-col gap-1 rounded-md border border-line bg-panel px-5 py-4 transition-colors hover:border-accent"
                    to={`/lists/${list.slug}`}
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="font-serif text-xl font-semibold text-ink group-hover:text-accent">
                        {list.title}
                      </span>
                      <span className="font-sans text-xs text-faint">{list.itemCount} books</span>
                    </span>
                    {list.intro ? (
                      <span className="font-sans text-sm text-muted">{list.intro}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PublicLayout>
  );
}
