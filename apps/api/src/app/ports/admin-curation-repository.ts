import type { DeleteResult } from './admin-catalogue-repository.js';

/** Write-side for lists and series — the curation tooling (docs/04 §Admin, docs/01 F6). */

export interface AdminListSummaryRow {
  id: string;
  slug: string;
  title: string;
  subjectName: string;
  parentTitle: string | null;
  isPublished: boolean;
  itemCount: number;
}

export interface AdminListItemRow {
  type: 'book' | 'series';
  /** The book id or series id this slot points at. */
  refId: string;
  title: string;
  rank: number;
  blurb: string | null;
}

export interface AdminListRow {
  id: string;
  slug: string;
  title: string;
  subjectId: string;
  parentListId: string | null;
  intro: string | null;
  isPublished: boolean;
  items: AdminListItemRow[];
}

/** Just the facts needed to enforce the sublist invariants (docs/03). */
export interface ListMeta {
  subjectId: string;
  parentListId: string | null;
  hasChildren: boolean;
}

export interface CreateListInput {
  title: string;
  slug: string;
  subjectId: string;
  intro: string | null;
}

export interface UpdateListInput {
  title: string;
  subjectId: string;
  intro: string | null;
  isPublished: boolean;
  parentListId: string | null;
}

/** One item to write into a list — exactly one of book/series (checked by the DB). */
export interface ListItemInput {
  bookId: string | null;
  seriesId: string | null;
  blurb: string | null;
}

export interface AdminSeriesSummaryRow {
  id: string;
  slug: string;
  title: string;
  bookCount: number;
}

export interface AdminSeriesRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  books: { id: string; title: string; seriesPosition: number | null }[];
}

export interface AdminCurationRepository {
  // --- lists ---
  listLists(): Promise<AdminListSummaryRow[]>;
  createList(input: CreateListInput): Promise<{ id: string; slug: string }>;
  getList(id: string): Promise<AdminListRow | null>;
  listMeta(id: string): Promise<ListMeta | null>;
  updateList(id: string, patch: UpdateListInput): Promise<{ id: string } | null>;
  deleteList(id: string): Promise<DeleteResult>;
  /** Replace a list's items with the given order (rank = array index) in one txn. */
  setListItems(listId: string, items: ListItemInput[]): Promise<void>;

  // --- series ---
  listSeries(): Promise<AdminSeriesSummaryRow[]>;
  createSeries(input: { title: string; slug: string; description: string | null }): Promise<{
    id: string;
    slug: string;
  }>;
  getSeries(id: string): Promise<AdminSeriesRow | null>;
  updateSeries(
    id: string,
    patch: { title: string; description: string | null },
  ): Promise<{ id: string } | null>;
  deleteSeries(id: string): Promise<DeleteResult>;
  /** Set the series' member books and their order (position = array index). */
  setSeriesBooks(seriesId: string, bookIds: string[]): Promise<void>;
}
