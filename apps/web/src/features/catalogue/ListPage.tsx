import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import type { ListItem } from '@bestbooks/shared';
import { catalogueKeys, fetchList } from './api.js';
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

function Item({ item }: { item: ListItem }) {
  const isBook = item.type === 'book';
  const title = isBook ? item.book.title : item.series.title;
  const to = isBook ? `/books/${item.book.slug}` : `/series/${item.series.slug}`;
  const coverUrl = isBook ? item.book.coverUrl : null;

  return (
    <li className="grid grid-cols-[2rem_3.4rem_1fr] items-start gap-x-4 gap-y-3 border-t border-line py-8 first:border-t-0 first:pt-2 sm:grid-cols-[2.6rem_4.4rem_1fr] sm:gap-x-6">
      <div className="pt-1 text-right font-serif text-3xl font-semibold tabular-nums text-accent sm:text-4xl">
        {item.rank}
      </div>
      <Link to={to} className="block" aria-label={`${title} cover`}>
        <Cover title={title} coverUrl={coverUrl} series={!isBook} />
      </Link>
      <div>
        <h3 className="font-serif text-xl font-semibold leading-tight tracking-tight">
          <Link className="text-ink hover:text-accent" to={to}>
            {title}
          </Link>
        </h3>
        <p className="mt-1.5 font-sans text-sm text-muted">
          {isBook ? (
            <>
              {item.book.authors.map((a) => a.name).join(', ')}
              {item.book.firstPublishedYear ? (
                <span className="text-faint"> · {item.book.firstPublishedYear}</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="mr-2 font-sans text-[0.68rem] font-bold uppercase tracking-widest text-accent">
                Series · {item.series.bookCount} books
              </span>
            </>
          )}
        </p>
        {item.blurb ? <p className="mt-3.5 text-ink">{item.blurb}</p> : null}
        {isBook ? (
          <div className="mt-3">
            <Rating avg={item.book.ratingAvg} count={item.book.ratingCount} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** A curated list: ranked book/series items and its sublists (docs/04 GET /lists/{slug}). */
export function ListPage() {
  const { slug = '' } = useParams();
  const { data, status, error } = useQuery({
    queryKey: catalogueKeys.list(slug),
    queryFn: () => fetchList(slug),
  });

  return (
    <PublicLayout>
      {status === 'pending' ? (
        <LoadingBlock label="Loading list…" />
      ) : status === 'error' ? (
        <ErrorBlock error={error} kind="list" />
      ) : (
        <>
          <PageMeta
            title={`${data.title} — Best Books Guide`}
            description={data.intro ?? `A curated, ranked list: ${data.title}.`}
          />
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: data.title,
              description: data.intro ?? undefined,
              itemListElement: data.items.map((item) => ({
                '@type': 'ListItem',
                position: item.rank,
                name: item.type === 'book' ? item.book.title : item.series.title,
              })),
            }}
          />
          <Crumbs
            trail={[
              { label: 'Home', to: '/' },
              { label: data.subject.name, to: `/subjects/${data.subject.slug}` },
              ...(data.parent
                ? [{ label: data.parent.title, to: `/lists/${data.parent.slug}` }]
                : []),
              { label: data.title },
            ]}
          />

          <header className="max-w-2xl">
            <p className="eyebrow">{data.subject.name} · Curated list</p>
            <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {data.title}
            </h1>
            {data.intro ? <p className="dropcap mt-6 text-ink">{data.intro}</p> : null}
            <p className="mt-6 border-t border-line pt-4 font-sans text-sm text-muted">
              {data.items.length > 0
                ? `${data.items.length} ${data.items.length === 1 ? 'entry' : 'entries'} · ranked`
                : `${data.sublists.length} reading ${data.sublists.length === 1 ? 'path' : 'paths'}`}
            </p>
          </header>

          {data.items.length > 0 ? (
            <ol className="mt-8 max-w-3xl">
              {data.items.map((item) => (
                <Item key={item.rank} item={item} />
              ))}
            </ol>
          ) : data.sublists.length === 0 ? (
            <p className="mt-8 text-muted">This list is still being assembled.</p>
          ) : null}

          {data.sublists.length > 0 ? (
            <div className="mt-12 max-w-3xl border-t border-line pt-6">
              <p className="eyebrow mb-4">Reading paths within this list</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.sublists.map((sub) => (
                  <Link
                    key={sub.slug}
                    to={`/lists/${sub.slug}`}
                    className="rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent"
                  >
                    <h4 className="font-serif text-lg font-semibold text-ink">{sub.title}</h4>
                    <p className="mt-1 font-sans text-sm text-muted">
                      {sub.itemCount} books
                      {sub.intro ? ` · ${sub.intro}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </PublicLayout>
  );
}
