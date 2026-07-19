import type { ReportReason } from '@bestbooks/shared';

/** A public review on a book page — never carries the author's user id. */
export interface PublicReviewRow {
  id: string;
  rating: number;
  body: string | null;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The caller's own review, including moderation state (so their view can flag it). */
export interface ViewerReviewRow {
  id: string;
  rating: number;
  body: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertReviewInput {
  userId: string;
  bookId: string;
  rating: number;
  body: string | null;
}

/**
 * A report the automated language screen files alongside the review write (docs/01
 * F5). `hide` = a severe hit, which also soft-hides the review pending human review;
 * a mild hit just queues (`hide = false`). Both use reporter_id NULL.
 */
export interface AutoLanguageReport {
  note: string;
  hide: boolean;
  hiddenReason: string | null;
}

/** One entry in the admin moderation queue (docs/03 §review_reports). */
export interface ReviewReportRow {
  id: string;
  reason: ReportReason;
  note: string | null;
  reporterName: string | null;
  createdAt: Date;
  review: {
    id: string;
    rating: number;
    body: string | null;
    isHidden: boolean;
    hiddenReason: string | null;
    authorName: string;
    bookTitle: string;
    bookSlug: string;
  };
}

export type ReportResult = 'ok' | 'not_found' | 'duplicate';

/**
 * Reviews, reports, and moderation (docs/03 §reviews/§review_reports). All aggregate
 * maintenance lives here: `books.rating_avg`/`rating_count` are recomputed (over
 * visible reviews only) in the *same transaction* as any insert/update/delete/hide,
 * so they can never drift under concurrent writes (docs/03 §aggregate maintenance).
 */
export interface ReviewRepository {
  findBookIdBySlug(slug: string): Promise<string | null>;

  /**
   * Insert or replace the member's review for a book, apply any language-screen
   * verdict, and recompute the book's aggregate — all in one transaction. Returns
   * the review id.
   */
  upsertReview(
    input: UpsertReviewInput,
    autoReport: AutoLanguageReport | null,
  ): Promise<{ id: string }>;

  /** Delete the member's review for a book and recompute. Returns whether one existed. */
  deleteReview(userId: string, bookId: string): Promise<boolean>;

  /** Visible reviews for a book, newest first, with author display names. */
  listPublicByBook(bookId: string): Promise<PublicReviewRow[]>;

  getViewerReview(userId: string, bookId: string): Promise<ViewerReviewRow | null>;

  /** File a member report. `duplicate` if they already reported it; `not_found` if the review is gone. */
  reportReview(
    reviewId: string,
    reporterId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<ReportResult>;

  // --- moderation (admin) ---
  /** The open queue: unresolved reports, oldest first, with review + book context. */
  listOpenReports(): Promise<ReviewReportRow[]>;

  /**
   * Soft-hide a review (reason recorded), recompute its book's aggregate, and resolve
   * that review's open reports. Returns whether the review existed.
   */
  hideReview(reviewId: string, reason: string, adminId: string): Promise<boolean>;

  /** Un-hide a review and recompute. Returns whether the review existed. */
  unhideReview(reviewId: string): Promise<boolean>;

  /** Resolve a single report without hiding (dismiss). Returns whether it existed & was open. */
  resolveReport(reportId: string, adminId: string): Promise<boolean>;
}
