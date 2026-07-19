import type { MyBooks, Review, ReviewReport, ShelfBook, ViewerReview } from '@bestbooks/shared';
import { toBookSummary } from './catalogue-view.js';
import type { MyBooksRows, ShelfBookRow } from './ports/reading-status-repository.js';
import type {
  PublicReviewRow,
  ReviewReportRow,
  ViewerReviewRow,
} from './ports/review-repository.js';

/**
 * Member read-model → public-contract mapping (docs/02 §clean-arch), the F3–F6
 * counterpart to catalogue-view. Timestamps become ISO strings at the edge; book
 * shapes reuse `toBookSummary` so covers get the same `/covers/…` URL treatment.
 */

export function toShelfBook(row: ShelfBookRow): ShelfBook {
  return {
    status: row.status,
    startedOn: row.startedOn,
    finishedOn: row.finishedOn,
    updatedAt: row.updatedAt.toISOString(),
    book: toBookSummary(row.book),
  };
}

export function toMyBooks(rows: MyBooksRows): MyBooks {
  return {
    want_to_read: rows.want_to_read.map(toShelfBook),
    reading: rows.reading.map(toShelfBook),
    finished: rows.finished.map(toShelfBook),
  };
}

export function toReview(row: PublicReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toViewerReview(row: ViewerReviewRow): ViewerReview {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    isHidden: row.isHidden,
    hiddenReason: row.hiddenReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toReviewReport(row: ReviewReportRow): ReviewReport {
  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    reporterName: row.reporterName,
    createdAt: row.createdAt.toISOString(),
    review: {
      id: row.review.id,
      rating: row.review.rating,
      body: row.review.body,
      isHidden: row.review.isHidden,
      hiddenReason: row.review.hiddenReason,
      authorName: row.review.authorName,
      bookTitle: row.review.bookTitle,
      bookSlug: row.review.bookSlug,
    },
  };
}
