import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { BookSummary, SubjectRef } from './catalogue.js';

/**
 * Member-feature contracts (docs/01 F3–F7, docs/04) — one source of truth for the
 * Fastify response schemas and the web client, mirroring the catalogue/auth modules.
 * Shelves, ratings, reviews, review reports, and tracked-list progress. Member reads
 * are never cached at the edge (they're per-user), so unlike the public catalogue
 * these shapes always reflect the caller.
 */

const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const bodyOptions = { additionalProperties: false } as const;

/** A written review's text cap (docs/03 §reviews). Enforced in the app layer. */
export const REVIEW_MAX_LENGTH = 5000;
/** Free-text cap on a report note. */
export const REPORT_NOTE_MAX_LENGTH = 500;

/** `YYYY-MM-DD` — dates ride as strings on the wire (no ajv-formats, docs/05). */
const IsoDate = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', maxLength: 10 });

// --- F3 reading status ("shelves") ---

export const ReadingStatus = Type.Union([
  Type.Literal('want_to_read'),
  Type.Literal('reading'),
  Type.Literal('finished'),
]);
export type ReadingStatus = Static<typeof ReadingStatus>;

/** Ordered for rendering "My Books" — the finished shelf doubles as the reading log. */
export const READING_STATUSES = ['want_to_read', 'reading', 'finished'] as const;

/**
 * Set/replace the caller's shelf for a book. `finishedOn` is only meaningful when
 * `status = finished` (docs/03 §reading_statuses); the API defaults it to today when
 * a book is marked finished without one, and clears it otherwise.
 */
export const SetReadingStatusBody = Type.Object(
  {
    status: ReadingStatus,
    startedOn: Type.Optional(Nullable(IsoDate)),
    finishedOn: Type.Optional(Nullable(IsoDate)),
  },
  bodyOptions,
);
export type SetReadingStatusBody = Static<typeof SetReadingStatusBody>;

/** A shelved book (My Books rows) — the summary plus this member's shelf metadata. */
export const ShelfBook = Type.Object({
  status: ReadingStatus,
  startedOn: Nullable(IsoDate),
  finishedOn: Nullable(IsoDate),
  updatedAt: Type.String(),
  book: BookSummary,
});
export type ShelfBook = Static<typeof ShelfBook>;

/** My Books, grouped by shelf (docs/01 F3). */
export const MyBooks = Type.Object({
  want_to_read: Type.Array(ShelfBook),
  reading: Type.Array(ShelfBook),
  finished: Type.Array(ShelfBook),
});
export type MyBooks = Static<typeof MyBooks>;

// --- F4/F5 ratings & reviews ---

const Rating = Type.Integer({ minimum: 1, maximum: 5 });

/** A review is a required rating + optional text (docs/01 F5). */
export const UpsertReviewBody = Type.Object(
  { rating: Rating, body: Type.Optional(Nullable(Type.String({ maxLength: REVIEW_MAX_LENGTH }))) },
  bodyOptions,
);
export type UpsertReviewBody = Static<typeof UpsertReviewBody>;

/** A public review as shown on a book page — never exposes the author's user id. */
export const Review = Type.Object({
  id: Type.String(),
  rating: Type.Integer(),
  body: Nullable(Type.String()),
  displayName: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export type Review = Static<typeof Review>;

/** The caller's own review, including moderation state so their view can flag it. */
export const ViewerReview = Type.Object({
  id: Type.String(),
  rating: Type.Integer(),
  body: Nullable(Type.String()),
  isHidden: Type.Boolean(),
  hiddenReason: Nullable(Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export type ViewerReview = Static<typeof ViewerReview>;

/** The caller's shelf for one book (the response to setting a shelf). */
export const ViewerShelf = Type.Object({
  status: Nullable(ReadingStatus),
  startedOn: Nullable(IsoDate),
  finishedOn: Nullable(IsoDate),
});
export type ViewerShelf = Static<typeof ViewerShelf>;

/** The caller's shelf + review for one book (docs/04 GET /me/books/{slug}). */
export const ViewerBook = Type.Object({
  status: Nullable(ReadingStatus),
  startedOn: Nullable(IsoDate),
  finishedOn: Nullable(IsoDate),
  review: Nullable(ViewerReview),
});
export type ViewerBook = Static<typeof ViewerBook>;

// --- F5 reporting & moderation ---

export const ReportReason = Type.Union([
  Type.Literal('spam'),
  Type.Literal('abuse'),
  Type.Literal('language'),
  Type.Literal('spoilers'),
  Type.Literal('other'),
]);
export type ReportReason = Static<typeof ReportReason>;

export const ReportReviewBody = Type.Object(
  {
    reason: ReportReason,
    note: Type.Optional(Nullable(Type.String({ maxLength: REPORT_NOTE_MAX_LENGTH }))),
  },
  bodyOptions,
);
export type ReportReviewBody = Static<typeof ReportReviewBody>;

/** One entry in the admin moderation queue (docs/01 F6, docs/03 §review_reports). */
export const ReviewReport = Type.Object({
  id: Type.String(),
  reason: ReportReason,
  note: Nullable(Type.String()),
  // null = filed by the automated language screen, not a member.
  reporterName: Nullable(Type.String()),
  createdAt: Type.String(),
  review: Type.Object({
    id: Type.String(),
    rating: Type.Integer(),
    body: Nullable(Type.String()),
    isHidden: Type.Boolean(),
    hiddenReason: Nullable(Type.String()),
    authorName: Type.String(),
    bookTitle: Type.String(),
    bookSlug: Type.String(),
  }),
});
export type ReviewReport = Static<typeof ReviewReport>;

export const HideReviewBody = Type.Object(
  { reason: Type.String({ minLength: 1, maxLength: 200 }) },
  bodyOptions,
);
export type HideReviewBody = Static<typeof HideReviewBody>;

// --- F7 track a list ---

/** Computed progress of a member's shelves against a list's books (docs/03 §tracked_lists). */
export const ListProgress = Type.Object({
  total: Type.Integer(),
  finished: Type.Integer(),
  reading: Type.Integer(),
  pctFinished: Type.Integer(),
  pctReading: Type.Integer(),
});
export type ListProgress = Static<typeof ListProgress>;

/** A tracked list on the member's home / My Books, with live progress. */
export const TrackedList = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  subject: SubjectRef,
  progress: ListProgress,
});
export type TrackedList = Static<typeof TrackedList>;

/** Whether the caller tracks a given list — drives the list page's Track button. */
export const ListTracking = Type.Object({ tracked: Type.Boolean() });
export type ListTracking = Static<typeof ListTracking>;
