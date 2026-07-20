import { Type, type Static, type TSchema } from '@sinclair/typebox';

/**
 * Public catalogue contracts (docs/04 §Public catalogue) — one source of truth for
 * the Fastify response schemas and the web client. Responses are serialised *from*
 * these schemas, so a field the API forgets to populate is a compile/validation
 * error, not a silent leak. All addressing is by slug (docs/04 §conventions).
 *
 * These are the anonymous public shapes — no member state is embedded. A signed-in
 * reader's shelf/rating/tracking come from the separate `/me/*` contracts (docs/04).
 */

/** `T | null` — mirrors how PublicUser spells nullable fields (no ajv-formats). */
const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);

/** A cover lives on local disk under the media dir; the API exposes it at /covers/. */
export const AuthorRef = Type.Object({ slug: Type.String(), name: Type.String() });
export type AuthorRef = Static<typeof AuthorRef>;

export const SubjectRef = Type.Object({ slug: Type.String(), name: Type.String() });
export type SubjectRef = Static<typeof SubjectRef>;

/** Compact reference to a list, used on subject pages and as a sublist "map" entry. */
export const ListSummary = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  intro: Nullable(Type.String()),
  itemCount: Type.Integer(),
});
export type ListSummary = Static<typeof ListSummary>;

/** A subject with its published top-level lists (docs/04 GET /subjects, /subjects/{slug}). */
export const SubjectDetail = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  description: Nullable(Type.String()),
  lists: Type.Array(ListSummary),
});
export type SubjectDetail = Static<typeof SubjectDetail>;

/** Lean book shape for lists, related strips, series pages, and search results. */
export const BookSummary = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  subtitle: Nullable(Type.String()),
  authors: Type.Array(AuthorRef),
  coverUrl: Nullable(Type.String()),
  firstPublishedYear: Nullable(Type.Integer()),
  ratingAvg: Type.Number(),
  ratingCount: Type.Integer(),
});
export type BookSummary = Static<typeof BookSummary>;

/** A series as it appears in a list slot (docs/01 F1) — one ranked entry, own page. */
export const SeriesSummary = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  description: Nullable(Type.String()),
  bookCount: Type.Integer(),
});
export type SeriesSummary = Static<typeof SeriesSummary>;

// A list item is a book OR a series (docs/03 §list_items) — a discriminated union
// on `type` so the client can switch without guessing.
const ItemCommon = { rank: Type.Integer(), blurb: Nullable(Type.String()) };
export const BookListItem = Type.Object({
  type: Type.Literal('book'),
  ...ItemCommon,
  book: BookSummary,
});
export const SeriesListItem = Type.Object({
  type: Type.Literal('series'),
  ...ItemCommon,
  series: SeriesSummary,
});
export const ListItem = Type.Union([BookListItem, SeriesListItem]);
export type ListItem = Static<typeof ListItem>;

/** A list + its ranked items and (for a parent) its published sublists (docs/04). */
export const ListDetail = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  intro: Nullable(Type.String()),
  subject: SubjectRef,
  // Set when this list is itself a sublist; null for a top-level list.
  parent: Nullable(Type.Object({ slug: Type.String(), title: Type.String() })),
  items: Type.Array(ListItem),
  // A parent list renders these as a map of its sublists; empty for a sublist.
  sublists: Type.Array(ListSummary),
});
export type ListDetail = Static<typeof ListDetail>;

export const RelatedBook = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  coverUrl: Nullable(Type.String()),
  // Why it's related — same author, or co-listed (docs/01 F1). Curation-graph
  // similarity is the post-MVP upgrade, never reader tracking.
  reason: Type.Union([Type.Literal('same-author'), Type.Literal('co-listed')]),
});
export type RelatedBook = Static<typeof RelatedBook>;

export const ListAppearance = Type.Object({
  listSlug: Type.String(),
  listTitle: Type.String(),
  rank: Type.Integer(),
});
export type ListAppearance = Static<typeof ListAppearance>;

/** Full book page (docs/04 worked example) — anonymous; member state comes from `/me/*`. */
export const BookDetail = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  subtitle: Nullable(Type.String()),
  authors: Type.Array(AuthorRef),
  description: Nullable(Type.String()),
  coverUrl: Nullable(Type.String()),
  firstPublishedYear: Nullable(Type.Integer()),
  pageCount: Nullable(Type.Integer()),
  language: Type.String(),
  subjects: Type.Array(SubjectRef),
  series: Nullable(
    Type.Object({ slug: Type.String(), title: Type.String(), position: Nullable(Type.Number()) }),
  ),
  listAppearances: Type.Array(ListAppearance),
  related: Type.Array(RelatedBook),
  ratingAvg: Type.Number(),
  ratingCount: Type.Integer(),
});
export type BookDetail = Static<typeof BookDetail>;

/** Series page: the series + its books in reading order (docs/04 GET /series/{slug}). */
export const SeriesDetail = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  description: Nullable(Type.String()),
  books: Type.Array(
    Type.Intersect([BookSummary, Type.Object({ seriesPosition: Nullable(Type.Number()) })]),
  ),
});
export type SeriesDetail = Static<typeof SeriesDetail>;

/** Cursor-paginated book list (docs/04 §pagination). `nextCursor` null = last page. */
export const BookListResponse = Type.Object({
  items: Type.Array(BookSummary),
  nextCursor: Nullable(Type.String()),
});
export type BookListResponse = Static<typeof BookListResponse>;

/** Query params for GET /books (search + subject filter + cursor page). */
export const BookListQuery = Type.Object(
  {
    search: Type.Optional(Type.String({ maxLength: 100 })),
    subject: Type.Optional(Type.String({ maxLength: 100 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
    cursor: Type.Optional(Type.String({ maxLength: 200 })),
  },
  { additionalProperties: false },
);
export type BookListQuery = Static<typeof BookListQuery>;
