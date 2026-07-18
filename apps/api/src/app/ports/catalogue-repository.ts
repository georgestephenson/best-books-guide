import type { AuthorRef, SubjectRef, ListAppearance } from '@bestbooks/shared';

/**
 * Read-model shapes the catalogue repository returns (docs/02 §clean-arch): close to
 * the public contracts, but carrying `coverPath` (relative, on-disk) rather than the
 * `/covers/…` URL — the app/view layer owns URL-building, keeping infra unaware of how
 * covers are served. Ratings come back as numbers (the DB stores numeric-as-string).
 */
export interface BookSummaryRow {
  slug: string;
  title: string;
  subtitle: string | null;
  authors: AuthorRef[];
  coverPath: string | null;
  firstPublishedYear: number | null;
  ratingAvg: number;
  ratingCount: number;
}

export interface SeriesSummaryRow {
  slug: string;
  title: string;
  description: string | null;
  bookCount: number;
}

export type ListItemRow =
  | { type: 'book'; rank: number; blurb: string | null; book: BookSummaryRow }
  | { type: 'series'; rank: number; blurb: string | null; series: SeriesSummaryRow };

export interface ListSummaryRow {
  slug: string;
  title: string;
  intro: string | null;
  itemCount: number;
}

export interface SubjectWithLists {
  slug: string;
  name: string;
  description: string | null;
  lists: ListSummaryRow[];
}

export interface ListReadModel {
  slug: string;
  title: string;
  intro: string | null;
  subject: SubjectRef;
  parent: { slug: string; title: string } | null;
  items: ListItemRow[];
  sublists: ListSummaryRow[];
}

export interface RelatedBookRow {
  slug: string;
  title: string;
  coverPath: string | null;
  reason: 'same-author' | 'co-listed';
}

export interface BookDetailRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  authors: AuthorRef[];
  description: string | null;
  coverPath: string | null;
  firstPublishedYear: number | null;
  pageCount: number | null;
  language: string;
  subjects: SubjectRef[];
  series: { slug: string; title: string; position: number | null } | null;
  listAppearances: ListAppearance[];
  related: RelatedBookRow[];
  ratingAvg: number;
  ratingCount: number;
}

export interface SeriesBookRow extends BookSummaryRow {
  seriesPosition: number | null;
}

export interface SeriesDetailRow {
  slug: string;
  title: string;
  description: string | null;
  books: SeriesBookRow[];
}

export interface BookSearchParams {
  search?: string;
  subjectSlug?: string;
  limit: number;
  /** Opaque keyset cursor from a previous page, or undefined for the first page. */
  cursor?: string;
}

export interface BookSearchResult {
  items: BookSummaryRow[];
  nextCursor: string | null;
}

/** Slugs of everything with a public page — drives sitemap.xml (docs/04). */
export interface SitemapSlugs {
  subjects: string[];
  lists: string[];
  books: string[];
  series: string[];
}

/**
 * Read-side of the catalogue. Public pages only: list/sublist visibility is enforced
 * here (a list is public only when it *and* its parent are published — docs/03), so a
 * use-case that gets `null` returns 404 without needing to know the rule. Write access
 * (admin CRUD, imports) is a separate port, added in M3 slice 5.
 */
export interface CatalogueRepository {
  /** Ordered subjects that have at least one published top-level list. */
  listPublishedSubjects(): Promise<SubjectWithLists[]>;
  findSubjectBySlug(slug: string): Promise<SubjectWithLists | null>;
  /** Full list, or null if it doesn't exist or isn't publicly visible. */
  findPublishedListBySlug(slug: string): Promise<ListReadModel | null>;
  searchBooks(params: BookSearchParams): Promise<BookSearchResult>;
  findBookBySlug(slug: string): Promise<BookDetailRow | null>;
  findSeriesBySlug(slug: string): Promise<SeriesDetailRow | null>;
  sitemapSlugs(): Promise<SitemapSlugs>;
}
