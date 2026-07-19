import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { catalogueKeys, fetchBook } from './api.js';
import {
  Chip,
  Cover,
  Crumbs,
  ErrorBlock,
  JsonLd,
  LoadingBlock,
  PageMeta,
  PublicLayout,
  Rating,
} from './components.js';
import { BookMemberPanel } from '../member/BookMemberPanel.js';

/** A book page: metadata, series, list appearances, related strip (docs/04 GET /books/{slug}). */
export function BookPage() {
  const { slug = '' } = useParams();
  const { data, status, error } = useQuery({
    queryKey: catalogueKeys.book(slug),
    queryFn: () => fetchBook(slug),
  });

  return (
    <PublicLayout>
      {status === 'pending' ? (
        <LoadingBlock label="Loading book…" />
      ) : status === 'error' ? (
        <ErrorBlock error={error} kind="book" />
      ) : (
        <>
          <PageMeta
            title={`${data.title} — Best Books Guide`}
            description={
              data.description?.slice(0, 155) ??
              `${data.title} by ${data.authors.map((a) => a.name).join(', ')}.`
            }
          />
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'Book',
              name: data.title,
              author: data.authors.map((a) => ({ '@type': 'Person', name: a.name })),
              ...(data.firstPublishedYear
                ? { datePublished: String(data.firstPublishedYear) }
                : {}),
              inLanguage: data.language,
              ...(data.ratingCount > 0
                ? {
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: data.ratingAvg,
                      ratingCount: data.ratingCount,
                    },
                  }
                : {}),
            }}
          />
          <Crumbs
            trail={[
              { label: 'Home', to: '/' },
              ...(data.subjects[0]
                ? [{ label: data.subjects[0].name, to: `/subjects/${data.subjects[0].slug}` }]
                : []),
              { label: data.title },
            ]}
          />

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[12rem_1fr] sm:gap-12">
            <div className="max-w-[10rem] sm:max-w-none">
              <Cover title={data.title} coverUrl={data.coverUrl} />
              <dl className="mt-5 grid gap-2 font-sans text-sm">
                <MetaRow label="First published" value={data.firstPublishedYear} />
                <MetaRow label="Pages" value={data.pageCount} />
                <MetaRow label="Language" value={data.language} />
                {data.series ? (
                  <div className="flex justify-between gap-4 border-b border-dotted border-line pb-2">
                    <dt className="text-faint">Series</dt>
                    <dd className="m-0 text-right">
                      <Link
                        className="text-accent hover:underline"
                        to={`/series/${data.series.slug}`}
                      >
                        {data.series.title}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div>
              <header>
                <p className="eyebrow">{data.subjects[0]?.name ?? 'Book'}</p>
                <h1 className="mt-2 text-balance font-serif text-3xl font-semibold leading-tight tracking-tight">
                  {data.title}
                </h1>
                {data.subtitle ? (
                  <p className="mt-1 font-serif text-xl text-muted">{data.subtitle}</p>
                ) : null}
                <p className="mt-2 font-sans text-muted">
                  by <span className="text-ink">{data.authors.map((a) => a.name).join(', ')}</span>
                </p>
                <div className="mt-3">
                  <Rating avg={data.ratingAvg} count={data.ratingCount} />
                </div>
              </header>

              {data.description ? (
                <div className="mt-6 max-w-2xl leading-relaxed">
                  {data.description.split('\n').map((para, i) =>
                    para.trim() ? (
                      <p key={i} className="mb-4">
                        {para}
                      </p>
                    ) : null,
                  )}
                </div>
              ) : null}

              {data.subjects.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {data.subjects.map((s) => (
                    <Link key={s.slug} to={`/subjects/${s.slug}`}>
                      <Chip>{s.name}</Chip>
                    </Link>
                  ))}
                </div>
              ) : null}

              {data.listAppearances.length > 0 ? (
                <section className="mt-10 border-t border-line pt-6">
                  <h2 className="eyebrow mb-4">Appears on</h2>
                  <ul className="grid gap-3">
                    {data.listAppearances.map((a) => (
                      <li key={a.listSlug} className="flex items-baseline gap-3 font-sans">
                        <span className="min-w-[2.2rem] font-bold tabular-nums text-accent">
                          #{a.rank}
                        </span>
                        <Link className="text-ink hover:text-accent" to={`/lists/${a.listSlug}`}>
                          {a.listTitle}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {data.related.length > 0 ? (
                <section className="mt-10 border-t border-line pt-6">
                  <h2 className="eyebrow mb-4">Related books</h2>
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                    {data.related.map((r) => (
                      <Link key={r.slug} to={`/books/${r.slug}`} className="block">
                        <Cover title={r.title} coverUrl={r.coverUrl} />
                        <h3 className="mt-2.5 font-serif text-base font-semibold leading-tight text-ink">
                          {r.title}
                        </h3>
                        <p className="mt-1 font-sans text-[0.68rem] uppercase tracking-wider text-faint">
                          {r.reason === 'same-author' ? 'Same author' : 'Co-listed'}
                        </p>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-4 font-sans text-sm text-faint">
                    Related titles stay inside the curated catalogue — same author and co-listed
                    books, never “readers also bought.”
                  </p>
                </section>
              ) : null}

              <BookMemberPanel slug={data.slug} />
            </div>
          </div>
        </>
      )}
    </PublicLayout>
  );
}

function MetaRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dotted border-line pb-2">
      <dt className="text-faint">{label}</dt>
      <dd className="m-0 text-right tabular-nums text-ink">{value ?? '—'}</dd>
    </div>
  );
}
