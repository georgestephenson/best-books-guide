import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REVIEW_MAX_LENGTH,
  type ReadingStatus,
  type ReportReason,
  type Review,
} from '@bestbooks/shared';
import { useAuth } from '../auth/AuthContext.js';
import { ApiError } from '../../lib/api.js';
import { catalogueKeys } from '../catalogue/api.js';
import {
  deleteReview,
  fetchBookReviews,
  fetchViewerBook,
  memberKeys,
  removeBookStatus,
  reportReview,
  setBookStatus,
  upsertReview,
} from './api.js';
import { STATUS_LABELS, StarInput } from './components.js';

const STATUSES: ReadingStatus[] = ['want_to_read', 'reading', 'finished'];
const REPORT_REASONS: ReportReason[] = ['spam', 'abuse', 'language', 'spoilers', 'other'];

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.problem?.detail ?? `Request failed (${err.status})`;
  return 'Something went wrong. Please try again.';
}

/**
 * The member-facing block on a book page (docs/01 F3–F5): shelf controls, the caller's
 * rating/review, and the public reviews list with reporting. Anonymous visitors see the
 * reviews and a sign-in prompt; unverified members can shelve but not rate/review.
 */
export function BookMemberPanel({ slug }: { slug: string }) {
  const { status: authStatus, user } = useAuth();
  const isAuthed = authStatus === 'authenticated' && Boolean(user);
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: memberKeys.bookReviews(slug),
    queryFn: () => fetchBookReviews(slug),
  });
  const viewerQuery = useQuery({
    queryKey: memberKeys.viewerBook(slug),
    queryFn: () => fetchViewerBook(slug),
    enabled: isAuthed,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: memberKeys.viewerBook(slug) });
    void queryClient.invalidateQueries({ queryKey: memberKeys.bookReviews(slug) });
    void queryClient.invalidateQueries({ queryKey: catalogueKeys.book(slug) });
    void queryClient.invalidateQueries({ queryKey: memberKeys.trackedLists });
    void queryClient.invalidateQueries({ queryKey: memberKeys.myBooks });
  };

  const viewer = viewerQuery.data;
  const ownReviewId = viewer?.review?.id ?? null;
  const publicReviews = (reviewsQuery.data ?? []).filter((r) => r.id !== ownReviewId);

  return (
    <section className="mt-10 border-t border-line pt-6" aria-label="Your library and reviews">
      {isAuthed ? (
        <div className="grid gap-6 rounded-lg border border-line bg-panel p-5">
          {viewerQuery.isPending ? (
            <p className="font-sans text-sm text-muted" role="status">
              Loading your shelf…
            </p>
          ) : (
            <>
              <ShelfControls slug={slug} status={viewer?.status ?? null} onChange={invalidate} />
              {/* Re-key on the review's identity so the editor re-initialises when the
                  caller's review first loads, or after it's created/deleted. */}
              <RatingReview
                key={viewer?.review?.id ?? 'new'}
                slug={slug}
                verified={Boolean(user?.emailVerifiedAt)}
                review={viewer?.review ?? null}
                onChange={invalidate}
              />
            </>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-panel p-5 font-sans text-sm text-muted">
          <Link className="text-accent hover:underline" to="/login">
            Sign in
          </Link>{' '}
          to shelve this book, rate it, and write a review.
        </p>
      )}

      <div className="mt-10">
        <h2 className="eyebrow mb-4">
          Reviews{publicReviews.length > 0 ? ` · ${publicReviews.length}` : ''}
        </h2>
        {reviewsQuery.isPending ? (
          <p className="font-sans text-sm text-muted" role="status">
            Loading reviews…
          </p>
        ) : publicReviews.length === 0 ? (
          <p className="font-sans text-sm text-faint">No reviews yet.</p>
        ) : (
          <ul className="grid gap-5">
            {publicReviews.map((r) => (
              <ReviewCard key={r.id} review={r} canReport={isAuthed} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ShelfControls({
  slug,
  status,
  onChange,
}: {
  slug: string;
  status: ReadingStatus | null;
  onChange: () => void;
}) {
  const setMut = useMutation({
    mutationFn: (s: ReadingStatus) => setBookStatus(slug, { status: s }),
    onSuccess: onChange,
  });
  const removeMut = useMutation({ mutationFn: () => removeBookStatus(slug), onSuccess: onChange });
  const busy = setMut.isPending || removeMut.isPending;

  return (
    <div>
      <p className="eyebrow mb-2">On your shelves</p>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            aria-pressed={status === s}
            onClick={() => setMut.mutate(s)}
            className={`rounded-md border px-3 py-1.5 font-sans text-sm transition-colors disabled:opacity-50 ${
              status === s
                ? 'border-accent bg-accent text-paper'
                : 'border-line text-muted hover:border-accent'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        {status ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => removeMut.mutate()}
            className="ml-1 font-sans text-sm text-faint hover:text-accent disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RatingReview({
  slug,
  verified,
  review,
  onChange,
}: {
  slug: string;
  verified: boolean;
  review: {
    rating: number;
    body: string | null;
    isHidden: boolean;
    hiddenReason: string | null;
  } | null;
  onChange: () => void;
}) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [body, setBody] = useState(review?.body ?? '');
  const [editing, setEditing] = useState(review === null);
  // Never show the read-only view without a review to read (guards the brief window
  // after posting, before the viewer query refetches the new review).
  const editorMode = editing || review === null;

  const saveMut = useMutation({
    mutationFn: () => upsertReview(slug, { rating, body: body.trim() ? body.trim() : null }),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteReview(slug),
    onSuccess: () => {
      setRating(0);
      setBody('');
      setEditing(true);
      onChange();
    },
  });

  if (!verified) {
    return (
      <div className="border-t border-line pt-5">
        <p className="eyebrow mb-2">Rate &amp; review</p>
        <p className="font-sans text-sm text-muted">
          Verify your email to rate and review.{' '}
          <Link className="text-accent hover:underline" to="/verify-email">
            Resend the link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line pt-5">
      <p className="eyebrow mb-2">Your rating &amp; review</p>

      {review?.isHidden ? (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 font-sans text-sm text-amber-900">
          Hidden by a moderator{review.hiddenReason ? `: ${review.hiddenReason}` : ''}. Only you can
          see it here.
        </p>
      ) : null}

      {editorMode ? (
        <div className="grid gap-3">
          <StarInput value={rating} onChange={setRating} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={REVIEW_MAX_LENGTH}
            rows={4}
            placeholder="Optional: what did you think? (a rating alone is fine)"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 font-sans text-sm text-ink focus:border-accent focus:outline-none"
          />
          {saveMut.isError ? (
            <p role="alert" className="font-sans text-sm text-red-700">
              {errorText(saveMut.error)}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={rating < 1 || saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="rounded-md border border-accent bg-accent px-4 py-1.5 font-sans text-sm text-paper transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {saveMut.isPending ? 'Saving…' : review ? 'Update' : 'Post review'}
            </button>
            {review ? (
              <button
                type="button"
                onClick={() => {
                  setRating(review.rating);
                  setBody(review.body ?? '');
                  setEditing(false);
                }}
                className="font-sans text-sm text-muted hover:text-accent"
              >
                Cancel
              </button>
            ) : null}
            {rating < 1 ? (
              <span className="font-sans text-xs text-faint">Pick a star rating to post</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <div aria-label={`Your rating: ${review!.rating} of 5`} className="text-2xl text-accent">
            {'★'.repeat(review!.rating)}
            <span className="text-line">{'★'.repeat(5 - review!.rating)}</span>
          </div>
          {review!.body ? <p className="text-ink">{review!.body}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-sans text-sm text-accent hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
              className="font-sans text-sm text-faint hover:text-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review, canReport }: { review: Review; canReport: boolean }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const reportMut = useMutation({
    mutationFn: () => reportReview(review.id, { reason }),
    onSuccess: () => setReporting(false),
  });

  return (
    <li className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg text-accent" aria-label={`Rated ${review.rating} of 5`}>
          {'★'.repeat(review.rating)}
          <span className="text-line">{'★'.repeat(5 - review.rating)}</span>
        </span>
        <span className="font-sans text-xs text-faint">{review.displayName}</span>
      </div>
      {review.body ? <p className="mt-2 text-ink">{review.body}</p> : null}
      {canReport ? (
        reportMut.isSuccess ? (
          <p className="mt-2 font-sans text-xs text-faint">
            Reported — thank you. A moderator will look.
          </p>
        ) : reporting ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Report reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="rounded-md border border-line bg-paper px-2 py-1 font-sans text-xs text-ink"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={reportMut.isPending}
              onClick={() => reportMut.mutate()}
              className="font-sans text-xs text-accent hover:underline disabled:opacity-50"
            >
              Submit report
            </button>
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="font-sans text-xs text-faint hover:text-accent"
            >
              Cancel
            </button>
            {reportMut.isError ? (
              <span role="alert" className="font-sans text-xs text-red-700">
                {errorText(reportMut.error)}
              </span>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="mt-2 font-sans text-xs text-faint hover:text-accent"
          >
            Report
          </button>
        )
      ) : null}
    </li>
  );
}
