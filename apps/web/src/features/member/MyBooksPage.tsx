import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router';
import type { MyBooks, ReadingStatus, ShelfBook } from '@bestbooks/shared';
import { useAuth } from '../auth/AuthContext.js';
import {
  Cover,
  Crumbs,
  ErrorBlock,
  LoadingBlock,
  PageMeta,
  PublicLayout,
} from '../catalogue/components.js';
import { fetchMyBooks, fetchTrackedLists, memberKeys } from './api.js';
import { STATUS_LABELS, TrackedListCard } from './components.js';

const SHELF_ORDER: ReadingStatus[] = ['reading', 'want_to_read', 'finished'];

function ShelfCard({ entry }: { entry: ShelfBook }) {
  return (
    <li>
      <Link to={`/books/${entry.book.slug}`} className="group block">
        <Cover title={entry.book.title} coverUrl={entry.book.coverUrl} />
        <h4 className="mt-2 font-serif text-sm font-semibold leading-tight text-ink group-hover:text-accent">
          {entry.book.title}
        </h4>
        <p className="mt-0.5 font-sans text-xs text-faint">
          {entry.book.authors.map((a) => a.name).join(', ')}
        </p>
        {entry.status === 'finished' && entry.finishedOn ? (
          <p className="mt-0.5 font-sans text-xs text-faint">Finished {entry.finishedOn}</p>
        ) : null}
      </Link>
    </li>
  );
}

function Shelf({ status, books }: { status: ReadingStatus; books: ShelfBook[] }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          {STATUS_LABELS[status]}
        </h2>
        <span className="eyebrow whitespace-nowrap">{books.length}</span>
      </div>
      {books.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-faint">Nothing here yet.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-3 gap-x-5 gap-y-7 sm:grid-cols-4 md:grid-cols-5">
          {books.map((entry) => (
            <ShelfCard key={entry.book.slug} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** My Books (docs/01 F3/F7): tracked lists with progress, then the three shelves. */
export function MyBooksPage() {
  const { status: authStatus } = useAuth();
  const myBooksQuery = useQuery({ queryKey: memberKeys.myBooks, queryFn: fetchMyBooks });
  const trackedQuery = useQuery({ queryKey: memberKeys.trackedLists, queryFn: fetchTrackedLists });

  if (authStatus === 'anonymous') return <Navigate to="/login" replace />;

  const my: MyBooks | undefined = myBooksQuery.data;
  const totalShelved = my ? my.want_to_read.length + my.reading.length + my.finished.length : 0;

  return (
    <PublicLayout>
      <PageMeta title="My Books — Best Books Guide" />
      <Crumbs trail={[{ label: 'Home', to: '/' }, { label: 'My Books' }]} />

      <header className="max-w-2xl">
        <p className="eyebrow">Your reading</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight tracking-tight">
          My Books
        </h1>
        <p className="mt-4 text-muted">
          Your shelves and the lists you track — private, quiet, and yours. The finished shelf is
          your reading log; nothing here nags you.
        </p>
      </header>

      {/* Tracked lists (F7) */}
      {trackedQuery.data && trackedQuery.data.length > 0 ? (
        <section className="mt-10">
          <h2 className="eyebrow mb-4">Lists you track</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {trackedQuery.data.map((list) => (
              <TrackedListCard key={list.slug} list={list} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Shelves (F3) */}
      <div className="mt-12">
        {authStatus === 'loading' || myBooksQuery.isPending ? (
          <LoadingBlock label="Loading your books…" />
        ) : myBooksQuery.isError ? (
          <ErrorBlock error={myBooksQuery.error} kind="library" />
        ) : totalShelved === 0 ? (
          <p className="max-w-xl text-muted">
            You haven&apos;t shelved anything yet. Browse the{' '}
            <Link className="text-accent hover:underline" to="/">
              curated lists
            </Link>{' '}
            and add a book to get started.
          </p>
        ) : (
          SHELF_ORDER.map((status) => <Shelf key={status} status={status} books={my![status]} />)
        )}
      </div>
    </PublicLayout>
  );
}
