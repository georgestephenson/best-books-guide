import type { HideReviewBody, ReviewReport } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { ReviewRepository } from '../ports/review-repository.js';
import { toReviewReport } from '../member-view.js';

/** The admin moderation queue — open reports, member and automated alike (docs/01 F6). */
export class ListReviewReports {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(): Promise<ReviewReport[]> {
    const rows = await this.reviews.listOpenReports();
    return rows.map(toReviewReport);
  }
}

/** Hide a reported review with a reason; resolves its open reports (docs/01 F6). */
export class HideReview {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(reviewId: string, adminId: string, body: HideReviewBody): Promise<void> {
    const ok = await this.reviews.hideReview(reviewId, body.reason, adminId);
    if (!ok) throw new NotFoundError('review not found');
  }
}

/** Reverse a hide (moderator undo). */
export class UnhideReview {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(reviewId: string): Promise<void> {
    const ok = await this.reviews.unhideReview(reviewId);
    if (!ok) throw new NotFoundError('review not found');
  }
}

/** Dismiss a report without hiding — the review stays visible. */
export class ResolveReport {
  constructor(private readonly reviews: ReviewRepository) {}

  async execute(reportId: string, adminId: string): Promise<void> {
    const ok = await this.reviews.resolveReport(reportId, adminId);
    if (!ok) throw new NotFoundError('report not found or already resolved');
  }
}
