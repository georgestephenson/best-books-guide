import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ReportReason } from '@bestbooks/shared';
import type {
  AutoLanguageReport,
  PublicReviewRow,
  ReportResult,
  ReviewReportRow,
  ReviewRepository,
  UpsertReviewInput,
  ViewerReviewRow,
} from '../../app/ports/review-repository.js';
import type { Database } from './pool.js';
import { books, reviewReports, reviews, users } from './schema/index.js';

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
}
const isUniqueViolation = (err: unknown): boolean => pgCode(err) === '23505';
/** A malformed uuid in the path (`22P02`) is treated as "no such row", not a 500. */
const isInvalidText = (err: unknown): boolean => pgCode(err) === '22P02';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export class DrizzleReviewRepository implements ReviewRepository {
  constructor(private readonly db: Database) {}

  async findBookIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.db.select({ id: books.id }).from(books).where(eq(books.slug, slug)).limit(1);
    return row?.id ?? null;
  }

  /**
   * Lock the book row for the duration of the transaction so concurrent
   * aggregate-affecting writes to the *same* book serialise — this is what keeps
   * `rating_avg`/`rating_count` from drifting under concurrent reviews (docs/03).
   */
  private async lockBook(tx: Tx, bookId: string): Promise<void> {
    await tx.select({ id: books.id }).from(books).where(eq(books.id, bookId)).for('update');
  }

  /** Recompute a book's aggregate over *visible* reviews only (docs/03 §aggregate maintenance). */
  private async recompute(tx: Tx, bookId: string): Promise<void> {
    const [agg] = await tx
      .select({
        avg: sql<string | null>`round(avg(${reviews.rating})::numeric, 2)`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(and(eq(reviews.bookId, bookId), eq(reviews.isHidden, false)));
    await tx
      .update(books)
      .set({ ratingAvg: agg?.avg ?? '0', ratingCount: agg?.count ?? 0 })
      .where(eq(books.id, bookId));
  }

  async upsertReview(
    input: UpsertReviewInput,
    autoReport: AutoLanguageReport | null,
  ): Promise<{ id: string }> {
    const hidden = autoReport?.hide ?? false;
    const hiddenReason = hidden ? autoReport?.hiddenReason ?? null : null;
    return this.db.transaction(async (tx) => {
      await this.lockBook(tx, input.bookId);
      const [row] = await tx
        .insert(reviews)
        .values({
          userId: input.userId,
          bookId: input.bookId,
          rating: input.rating,
          body: input.body,
          isHidden: hidden,
          hiddenReason,
        })
        .onConflictDoUpdate({
          target: [reviews.userId, reviews.bookId],
          // A re-submission is re-screened: it resets the hidden flag to the latest
          // verdict, so editing severe text to clean text un-hides it.
          set: { rating: input.rating, body: input.body, isHidden: hidden, hiddenReason },
        })
        .returning({ id: reviews.id });

      // Keep automated reports in sync with the latest screen: clear open system
      // reports (reporter NULL), then re-file if the newest submission flagged.
      await tx
        .delete(reviewReports)
        .where(
          and(
            eq(reviewReports.reviewId, row!.id),
            isNull(reviewReports.reporterId),
            isNull(reviewReports.resolvedAt),
          ),
        );
      if (autoReport) {
        await tx
          .insert(reviewReports)
          .values({ reviewId: row!.id, reporterId: null, reason: 'language', note: autoReport.note });
      }

      await this.recompute(tx, input.bookId);
      return { id: row!.id };
    });
  }

  async deleteReview(userId: string, bookId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await this.lockBook(tx, bookId);
      const deleted = await tx
        .delete(reviews)
        .where(and(eq(reviews.userId, userId), eq(reviews.bookId, bookId)))
        .returning({ id: reviews.id });
      await this.recompute(tx, bookId);
      return deleted.length > 0;
    });
  }

  async listPublicByBook(bookId: string): Promise<PublicReviewRow[]> {
    return this.db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        displayName: users.displayName,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.bookId, bookId), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt));
  }

  async getViewerReview(userId: string, bookId: string): Promise<ViewerReviewRow | null> {
    const [row] = await this.db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        isHidden: reviews.isHidden,
        hiddenReason: reviews.hiddenReason,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.bookId, bookId)))
      .limit(1);
    return row ?? null;
  }

  async reportReview(
    reviewId: string,
    reporterId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<ReportResult> {
    try {
      const [rv] = await this.db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1);
      if (!rv) return 'not_found';
      await this.db.insert(reviewReports).values({ reviewId, reporterId, reason, note });
      return 'ok';
    } catch (err) {
      if (isUniqueViolation(err)) return 'duplicate';
      if (isInvalidText(err)) return 'not_found';
      throw err;
    }
  }

  async listOpenReports(): Promise<ReviewReportRow[]> {
    const reporter = alias(users, 'reporter');
    const author = alias(users, 'author');
    const rows = await this.db
      .select({
        id: reviewReports.id,
        reason: reviewReports.reason,
        note: reviewReports.note,
        reporterName: reporter.displayName,
        createdAt: reviewReports.createdAt,
        reviewId: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        isHidden: reviews.isHidden,
        hiddenReason: reviews.hiddenReason,
        authorName: author.displayName,
        bookTitle: books.title,
        bookSlug: books.slug,
      })
      .from(reviewReports)
      .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
      .innerJoin(author, eq(author.id, reviews.userId))
      .innerJoin(books, eq(books.id, reviews.bookId))
      .leftJoin(reporter, eq(reporter.id, reviewReports.reporterId))
      .where(isNull(reviewReports.resolvedAt))
      .orderBy(reviewReports.createdAt);

    return rows.map((r) => ({
      id: r.id,
      reason: r.reason as ReportReason,
      note: r.note,
      reporterName: r.reporterName,
      createdAt: r.createdAt,
      review: {
        id: r.reviewId,
        rating: r.rating,
        body: r.body,
        isHidden: r.isHidden,
        hiddenReason: r.hiddenReason,
        authorName: r.authorName,
        bookTitle: r.bookTitle,
        bookSlug: r.bookSlug,
      },
    }));
  }

  private async bookIdForReview(tx: Tx, reviewId: string): Promise<string | null> {
    try {
      const [rv] = await tx
        .select({ bookId: reviews.bookId })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1);
      return rv?.bookId ?? null;
    } catch (err) {
      if (isInvalidText(err)) return null;
      throw err;
    }
  }

  async hideReview(reviewId: string, reason: string, adminId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const bookId = await this.bookIdForReview(tx, reviewId);
      if (!bookId) return false;
      await this.lockBook(tx, bookId);
      await tx
        .update(reviews)
        .set({ isHidden: true, hiddenReason: reason })
        .where(eq(reviews.id, reviewId));
      // The admin acted, so this review's open reports are resolved.
      await tx
        .update(reviewReports)
        .set({ resolvedAt: sql`now()`, resolvedBy: adminId })
        .where(and(eq(reviewReports.reviewId, reviewId), isNull(reviewReports.resolvedAt)));
      await this.recompute(tx, bookId);
      return true;
    });
  }

  async unhideReview(reviewId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const bookId = await this.bookIdForReview(tx, reviewId);
      if (!bookId) return false;
      await this.lockBook(tx, bookId);
      await tx
        .update(reviews)
        .set({ isHidden: false, hiddenReason: null })
        .where(eq(reviews.id, reviewId));
      await this.recompute(tx, bookId);
      return true;
    });
  }

  async resolveReport(reportId: string, adminId: string): Promise<boolean> {
    try {
      const updated = await this.db
        .update(reviewReports)
        .set({ resolvedAt: sql`now()`, resolvedBy: adminId })
        .where(and(eq(reviewReports.id, reportId), isNull(reviewReports.resolvedAt)))
        .returning({ id: reviewReports.id });
      return updated.length > 0;
    } catch (err) {
      if (isInvalidText(err)) return false;
      throw err;
    }
  }
}
