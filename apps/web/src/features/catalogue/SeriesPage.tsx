import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { catalogueKeys, fetchSeries } from './api.js';
import {
  Cover,
  Crumbs,
  ErrorBlock,
  JsonLd,
  LoadingBlock,
  PageMeta,
  PublicLayout,
  Rating,
} from './components.js';

/** A series page: its books in reading order (docs/04 GET /series/{slug}). */
export function SeriesPage() {
  const { slug = '' } = useParams();
  const { data, status, error } = useQuery({
    queryKey: catalogueKeys.series(slug),
    queryFn: () => fetchSeries(slug),
  });

  return (
    <PublicLayout>
      {status === 'pending' ? (
        <LoadingBlock label="Loading series…" />
      ) : status === 'error' ? (
        <ErrorBlock error={error} kind="series" />
      ) : (
        <>
          <PageMeta
            title={`${data.title} — Best Books Guide`}
            description={data.description ?? `The ${data.title} series in reading order.`}
          />
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'BookSeries',
              name: data.title,
              description: data.description ?? undefined,
              hasPart: data.books.map((b) => ({ '@type': 'Book', name: b.title })),
            }}
          />
          <Crumbs trail={[{ label: 'Home', to: '/' }, { label: data.title }]} />

          <header className="max-w-2xl">
            <p className="eyebrow">Series · {data.books.length} books</p>
            <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
              {data.title}
            </h1>
            {data.description ? (
              <p className="mt-4 text-lg text-muted">{data.description}</p>
            ) : null}
            <p className="mt-6 border-t border-line pt-4 font-sans text-sm text-muted">
              In reading order
            </p>
          </header>

          <ol className="mt-8 max-w-3xl">
            {data.books.map((book, i) => (
              <li
                key={book.slug}
                className="grid grid-cols-[2rem_3.4rem_1fr] items-start gap-x-4 gap-y-2 border-t border-line py-6 first:border-t-0 sm:grid-cols-[2.6rem_4.4rem_1fr] sm:gap-x-6"
              >
                <div className="pt-1 text-right font-serif text-2xl font-semibold tabular-nums text-accent">
                  {book.seriesPosition ?? i + 1}
                </div>
                <Link to={`/books/${book.slug}`} aria-label={`${book.title} cover`}>
                  <Cover title={book.title} coverUrl={book.coverUrl} />
                </Link>
                <div>
                  <h3 className="font-serif text-lg font-semibold leading-tight">
                    <Link className="text-ink hover:text-accent" to={`/books/${book.slug}`}>
                      {book.title}
                    </Link>
                  </h3>
                  <p className="mt-1 font-sans text-sm text-muted">
                    {book.authors.map((a) => a.name).join(', ')}
                    {book.firstPublishedYear ? (
                      <span className="text-faint"> · {book.firstPublishedYear}</span>
                    ) : null}
                  </p>
                  <div className="mt-2">
                    <Rating avg={book.ratingAvg} count={book.ratingCount} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </PublicLayout>
  );
}
