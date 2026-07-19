import type {
  Review,
  ReportReviewBody,
  UpsertReviewBody,
  ViewerBook,
  ViewerReview,
} from '@bestbooks/shared';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import type { LanguageScreen } from '../ports/language-screen.js';
import type { ReadingStatusRepository } from '../ports/reading-status-repository.js';
import type { AutoLanguageReport, ReviewRepository } from '../ports/review-repository.js';
import { toReview, toViewerReview } from '../member-view.js';

/** Normalise review text: trim, and treat empty as "no body" (a bare star rating). */
function normaliseBody(body: string | null | undefined): string | null {
  const trimmed = (body ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Create or update the caller's review for a book (docs/01 F4/F5). Written text is run
 * through the automated language screen: a severe hit auto-hides the review and files
 * a system report; a mild hit publishes but auto-reports; clean text just publishes.
 * The email-verified gate is enforced at the route (`requireVerified`).
 */
export class UpsertReview {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly screen: LanguageScreen,
  ) {}

  async execute(userId: string, bookSlug: string, body: UpsertReviewBody): Promise<ViewerReview> {
    const bookId = await this.reviews.findBookIdBySlug(bookSlug);
    if (!bookId) throw new NotFoundError('book not found');

    const text = normaliseBody(body.body);
    let autoReport: AutoLanguageReport | null = null;
    if (text) {
      const verdict = this.screen.screen(text);
      if (verdict.severity !== 'clean') {
        const flagged =
          verdict.matches.length > 0 ? ` (flagged: ${verdict.matches.join(', ')})` : '';
        autoReport = {
          note: `Automated language screen — ${verdict.severity}${flagged}`,
          hide: verdict.severity === 'severe',
          hiddenReason:
            verdict.severity === 'severe' ? 'Automated language screen (pending review)' : null,
        };
      }
    }

    await this.reviews.upsertReview(
      { userId, bookId, rating: body.rating, body: text },
      autoReport,
    );
    const review = await this.reviews.getViewerReview(userId, bookId);
    return toViewerReview(review!);
  }
}

/** Delete the caller's own review (docs/01 F5 — deletable by author). */
export class DeleteReview {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(userId: string, bookSlug: string): Promise<void> {
    const bookId = await this.reviews.findBookIdBySlug(bookSlug);
    if (!bookId) throw new NotFoundError('book not found');
    const deleted = await this.reviews.deleteReview(userId, bookId);
    if (!deleted) throw new NotFoundError('you have no review for this book');
  }
}

/** Public reviews for a book page — visible ones only (docs/04). Anonymous. */
export class GetBookReviews {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(bookSlug: string): Promise<Review[]> {
    const bookId = await this.reviews.findBookIdBySlug(bookSlug);
    if (!bookId) throw new NotFoundError('book not found');
    const rows = await this.reviews.listPublicByBook(bookId);
    return rows.map(toReview);
  }
}

/** The caller's shelf + own review for a book (drives the book page's member widgets). */
export class GetViewerBook {
  constructor(
    private readonly shelves: ReadingStatusRepository,
    private readonly reviews: ReviewRepository,
  ) {}

  async execute(userId: string, bookSlug: string): Promise<ViewerBook> {
    const bookId = await this.shelves.findBookIdBySlug(bookSlug);
    if (!bookId) throw new NotFoundError('book not found');
    const [shelf, review] = await Promise.all([
      this.shelves.get(userId, bookId),
      this.reviews.getViewerReview(userId, bookId),
    ]);
    return {
      status: shelf?.status ?? null,
      startedOn: shelf?.startedOn ?? null,
      finishedOn: shelf?.finishedOn ?? null,
      review: review ? toViewerReview(review) : null,
    };
  }
}

/** Any member can report a review; it stays visible until an admin acts (docs/01 F5). */
export class ReportReview {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(reviewId: string, reporterId: string, body: ReportReviewBody): Promise<void> {
    const result = await this.reviews.reportReview(
      reviewId,
      reporterId,
      body.reason,
      body.note ?? null,
    );
    if (result === 'not_found') throw new NotFoundError('review not found');
    if (result === 'duplicate') throw new ConflictError('you have already reported this review');
  }
}
