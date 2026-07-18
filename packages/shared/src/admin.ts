import { Type, type Static, type TSchema } from '@sinclair/typebox';

/**
 * Admin catalogue contracts (docs/04 §Admin) — Open Library import + manual CRUD.
 * Admin resources are addressed by **id** (not slug), per docs/04 conventions.
 */

const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const opts = { additionalProperties: false } as const;

// --- Open Library ---
export const OpenLibrarySearchQuery = Type.Object(
  { q: Type.String({ minLength: 1, maxLength: 200 }) },
  opts,
);
export type OpenLibrarySearchQuery = Static<typeof OpenLibrarySearchQuery>;

export const OpenLibraryResult = Type.Object({
  workKey: Type.String(),
  title: Type.String(),
  authorNames: Type.Array(Type.String()),
  firstPublishYear: Nullable(Type.Integer()),
  coverId: Nullable(Type.Integer()),
});
export type OpenLibraryResult = Static<typeof OpenLibraryResult>;

export const ImportBookBody = Type.Object(
  { workKey: Type.String({ minLength: 1, maxLength: 100 }) },
  opts,
);
export type ImportBookBody = Static<typeof ImportBookBody>;

// --- books ---
export const BookWriteBody = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 500 }),
    subtitle: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
    description: Type.Optional(Nullable(Type.String({ maxLength: 20000 }))),
    isbn13: Type.Optional(Nullable(Type.String({ pattern: '^[0-9]{13}$' }))),
    firstPublishedYear: Type.Optional(Nullable(Type.Integer({ minimum: -3000, maximum: 2100 }))),
    pageCount: Type.Optional(Nullable(Type.Integer({ minimum: 1, maximum: 100000 }))),
    language: Type.Optional(Type.String({ minLength: 2, maxLength: 20 })),
    authors: Type.Array(Type.String({ minLength: 1, maxLength: 200 }), { maxItems: 30 }),
    subjectIds: Type.Array(Type.String(), { maxItems: 30 }),
  },
  opts,
);
export type BookWriteBody = Static<typeof BookWriteBody>;

export const BookRefResponse = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
});
export type BookRefResponse = Static<typeof BookRefResponse>;

export const AdminBookListItem = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  authorNames: Type.Array(Type.String()),
  coverUrl: Nullable(Type.String()),
});
export type AdminBookListItem = Static<typeof AdminBookListItem>;

export const AdminBook = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  subtitle: Nullable(Type.String()),
  description: Nullable(Type.String()),
  isbn13: Nullable(Type.String()),
  olWorkKey: Nullable(Type.String()),
  coverUrl: Nullable(Type.String()),
  firstPublishedYear: Nullable(Type.Integer()),
  pageCount: Nullable(Type.Integer()),
  language: Type.String(),
  authors: Type.Array(Type.Object({ id: Type.String(), name: Type.String() })),
  subjectIds: Type.Array(Type.String()),
});
export type AdminBook = Static<typeof AdminBook>;

// --- subjects ---
export const SubjectWriteBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  },
  opts,
);
export type SubjectWriteBody = Static<typeof SubjectWriteBody>;

export const AdminSubject = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Nullable(Type.String()),
  position: Type.Integer(),
});
export type AdminSubject = Static<typeof AdminSubject>;

export const ReorderSubjectsBody = Type.Object(
  { orderedIds: Type.Array(Type.String(), { maxItems: 500 }) },
  opts,
);
export type ReorderSubjectsBody = Static<typeof ReorderSubjectsBody>;

// --- lists ---
export const ListCreateBody = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 300 }),
    subjectId: Type.String({ minLength: 1 }),
    intro: Type.Optional(Nullable(Type.String({ maxLength: 5000 }))),
  },
  opts,
);
export type ListCreateBody = Static<typeof ListCreateBody>;

export const ListUpdateBody = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 300 }),
    subjectId: Type.String({ minLength: 1 }),
    intro: Type.Optional(Nullable(Type.String({ maxLength: 5000 }))),
    isPublished: Type.Boolean(),
    parentListId: Type.Optional(Nullable(Type.String())),
  },
  opts,
);
export type ListUpdateBody = Static<typeof ListUpdateBody>;

export const AdminListSummary = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  subjectName: Type.String(),
  parentTitle: Nullable(Type.String()),
  isPublished: Type.Boolean(),
  itemCount: Type.Integer(),
});
export type AdminListSummary = Static<typeof AdminListSummary>;

export const AdminListItem = Type.Object({
  type: Type.Union([Type.Literal('book'), Type.Literal('series')]),
  refId: Type.String(),
  title: Type.String(),
  rank: Type.Integer(),
  blurb: Nullable(Type.String()),
});
export type AdminListItem = Static<typeof AdminListItem>;

export const AdminListDetail = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  subjectId: Type.String(),
  parentListId: Nullable(Type.String()),
  intro: Nullable(Type.String()),
  isPublished: Type.Boolean(),
  items: Type.Array(AdminListItem),
});
export type AdminListDetail = Static<typeof AdminListDetail>;

export const SetListItemsBody = Type.Object(
  {
    items: Type.Array(
      Type.Object(
        {
          bookId: Type.Optional(Type.String()),
          seriesId: Type.Optional(Type.String()),
          blurb: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
        },
        opts,
      ),
      { maxItems: 200 },
    ),
  },
  opts,
);
export type SetListItemsBody = Static<typeof SetListItemsBody>;

// --- series ---
export const SeriesWriteBody = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 300 }),
    description: Type.Optional(Nullable(Type.String({ maxLength: 5000 }))),
  },
  opts,
);
export type SeriesWriteBody = Static<typeof SeriesWriteBody>;

export const AdminSeriesSummary = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  bookCount: Type.Integer(),
});
export type AdminSeriesSummary = Static<typeof AdminSeriesSummary>;

export const AdminSeriesDetail = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  description: Nullable(Type.String()),
  books: Type.Array(
    Type.Object({
      id: Type.String(),
      title: Type.String(),
      seriesPosition: Nullable(Type.Number()),
    }),
  ),
});
export type AdminSeriesDetail = Static<typeof AdminSeriesDetail>;

export const SetSeriesBooksBody = Type.Object(
  { bookIds: Type.Array(Type.String(), { maxItems: 200 }) },
  opts,
);
export type SetSeriesBooksBody = Static<typeof SetSeriesBooksBody>;
