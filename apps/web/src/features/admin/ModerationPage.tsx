import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewReport } from '@bestbooks/shared';
import { AdminLayout, FormError } from './AdminLayout.js';
import {
  hideReview,
  listReviewReports,
  moderationKeys,
  resolveReport,
  unhideReview,
} from './api.js';
import { ApiError } from '../../lib/api.js';

function errorText(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof ApiError) return err.problem?.detail ?? `Request failed (${err.status})`;
  return 'Something went wrong.';
}

function ReportCard({ report }: { report: ReviewReport }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('Violates the community guidelines');
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: moderationKeys.reports });

  const hideMut = useMutation({
    mutationFn: () => hideReview(report.review.id, { reason }),
    onSuccess: invalidate,
  });
  const unhideMut = useMutation({
    mutationFn: () => unhideReview(report.review.id),
    onSuccess: invalidate,
  });
  const resolveMut = useMutation({
    mutationFn: () => resolveReport(report.id),
    onSuccess: invalidate,
  });
  const busy = hideMut.isPending || unhideMut.isPending || resolveMut.isPending;

  const { review } = report;
  return (
    <li className="rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs">
        <span className="rounded-sm bg-accent-wash px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
          {report.reason}
        </span>
        <span className="text-muted">
          {report.reporterName ? `Reported by ${report.reporterName}` : 'Automated language screen'}
        </span>
        {review.isHidden ? (
          <span className="rounded-sm bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
            Currently hidden
          </span>
        ) : null}
        <span className="ml-auto text-faint">
          {new Date(report.createdAt).toLocaleDateString()}
        </span>
      </div>

      {report.note ? (
        <p className="mt-2 font-sans text-sm text-muted">Note: {report.note}</p>
      ) : null}

      <blockquote className="mt-3 border-l-2 border-line pl-3">
        <div className="text-lg text-accent" aria-label={`Rated ${review.rating} of 5`}>
          {'★'.repeat(review.rating)}
          <span className="text-line">{'★'.repeat(5 - review.rating)}</span>
        </div>
        {review.body ? (
          <p className="mt-1 text-ink">{review.body}</p>
        ) : (
          <p className="mt-1 text-faint">(rating only)</p>
        )}
        <p className="mt-2 font-sans text-xs text-faint">
          by {review.authorName} on{' '}
          <Link className="text-accent hover:underline" to={`/books/${review.bookSlug}`}>
            {review.bookTitle}
          </Link>
        </p>
      </blockquote>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {review.isHidden ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => unhideMut.mutate()}
            className="rounded-md border border-line px-3 py-1.5 font-sans text-sm text-muted hover:border-accent disabled:opacity-50"
          >
            Unhide
          </button>
        ) : (
          <>
            <input
              aria-label="Hide reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-w-[16rem] flex-1 rounded-md border border-line bg-paper px-3 py-1.5 font-sans text-sm text-ink"
            />
            <button
              type="button"
              disabled={busy || reason.trim().length === 0}
              onClick={() => hideMut.mutate()}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 font-sans text-sm text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Hide review
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => resolveMut.mutate()}
          className="font-sans text-sm text-muted hover:text-accent disabled:opacity-50"
        >
          Dismiss report
        </button>
      </div>
      <FormError message={errorText(hideMut.error ?? unhideMut.error ?? resolveMut.error)} />
    </li>
  );
}

/** The reported-review moderation queue (docs/01 F6). Member and automated reports alike. */
export function ModerationPage() {
  const { data, status, error } = useQuery({
    queryKey: moderationKeys.reports,
    queryFn: listReviewReports,
  });

  return (
    <AdminLayout>
      <header className="mb-8">
        <p className="eyebrow">Moderation</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Review reports</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Machines flag, you decide. Hide a review (with a reason the author sees), unhide it, or
          dismiss the report if it&apos;s fine.
        </p>
      </header>

      {status === 'pending' ? (
        <p className="font-sans text-sm text-muted" role="status">
          Loading the queue…
        </p>
      ) : status === 'error' ? (
        <FormError message={errorText(error)} />
      ) : data.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel p-6 font-sans text-sm text-muted">
          The queue is empty. Nothing needs your attention.
        </p>
      ) : (
        <ul className="grid gap-4">
          {data.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
