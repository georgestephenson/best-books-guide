import { pgTable, uuid, text, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pkId, createdAt } from './columns.js';
import { users } from './users.js';
import { reviews } from './reviews.js';

/**
 * review_reports (docs/03 §review_reports) — the moderation queue's rows (F5/F6).
 * `reporter_id IS NULL` means the report was filed by the automated language screen
 * rather than a member; the partial unique lets each member report a review once
 * while allowing any number of system reports. `resolved_at IS NULL` is the open
 * queue. `resolved_by` points at the admin who acted (SET NULL if that user is later
 * removed). The review FK CASCADEs, so hiding history vanishes with its review.
 */
export const reviewReports = pgTable(
  'review_reports',
  {
    id: pkId(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    // Nullable: null = the automated screen filed it (docs/01 F5).
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    note: text('note'),
    createdAt: createdAt(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    check(
      'review_reports_reason_check',
      sql`${table.reason} in ('spam', 'abuse', 'language', 'spoilers', 'other')`,
    ),
    // One report per member per review; system reports (reporter NULL) are exempt.
    uniqueIndex('review_reports_member_unique')
      .on(table.reviewId, table.reporterId)
      .where(sql`${table.reporterId} is not null`),
    // The open-queue scan and per-review lookups.
    index('review_reports_open_idx').on(table.resolvedAt),
    index('review_reports_review_idx').on(table.reviewId),
  ],
);

export type ReviewReportRow = typeof reviewReports.$inferSelect;
export type NewReviewReportRow = typeof reviewReports.$inferInsert;
