import { useState } from 'react';
import { Link } from 'react-router';
import type { ReadingStatus, TrackedList } from '@bestbooks/shared';

/** Human labels for the three shelves (docs/01 F3). */
export const STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  finished: 'Finished',
};

/**
 * An interactive 1–5 star input (docs/01 F4). A radiogroup so it's keyboard- and
 * screen-reader-navigable; hover/focus previews the value without committing.
 */
export function StarInput({
  value,
  onChange,
  disabled = false,
  label = 'Your rating',
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          disabled={disabled}
          className={`px-0.5 text-2xl leading-none transition-colors disabled:cursor-not-allowed ${
            n <= shown ? 'text-accent' : 'text-line hover:text-accent/50'
          }`}
          onMouseEnter={() => !disabled && setHover(n)}
          onFocus={() => !disabled && setHover(n)}
          onClick={() => !disabled && onChange(n)}
        >
          {n <= shown ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

/**
 * A member's progress against a tracked list (docs/01 F7) — a quiet stacked bar
 * (finished solid, reading lighter) with the "X% read · Y% reading" caption. Calm by
 * construction: the number only moves when the member shelves something.
 */
export function ProgressBar({ progress }: { progress: TrackedList['progress'] }) {
  const { pctFinished, pctReading, finished, reading, total } = progress;
  return (
    <div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={pctFinished}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pctFinished}% finished`}
      >
        <div className="h-full bg-accent" style={{ width: `${pctFinished}%` }} />
        <div className="h-full bg-accent/30" style={{ width: `${pctReading}%` }} />
      </div>
      <p className="mt-1.5 font-sans text-xs text-muted">
        {total === 0 ? (
          'No books yet'
        ) : (
          <>
            <strong className="text-ink">{pctFinished}% read</strong>
            {reading > 0 ? <span className="text-faint"> · {pctReading}% reading</span> : null}
            <span className="text-faint">
              {' '}
              · {finished}/{total} finished
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/** A tracked list on the member's home / My Books (docs/01 F7). */
export function TrackedListCard({ list }: { list: TrackedList }) {
  return (
    <Link
      to={`/lists/${list.slug}`}
      className="block rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent"
    >
      <p className="eyebrow">{list.subject.name}</p>
      <h3 className="mt-1 font-serif text-lg font-semibold text-ink">{list.title}</h3>
      <div className="mt-3">
        <ProgressBar progress={list.progress} />
      </div>
    </Link>
  );
}
