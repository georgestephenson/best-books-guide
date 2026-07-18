import type {
  BookDetail,
  BookSummary,
  ListDetail,
  ListItem,
  SeriesDetail,
  SubjectDetail,
} from '@bestbooks/shared';
import type {
  BookDetailRow,
  BookSummaryRow,
  ListItemRow,
  ListReadModel,
  SeriesDetailRow,
  SubjectWithLists,
} from './ports/catalogue-repository.js';

/**
 * Read-model → public-contract mapping (docs/02 §clean-arch). The one real
 * transformation is `coverPath` → the `/covers/…` URL nginx serves (docs/02); the
 * rest is shape-narrowing that keeps infra unaware of the wire contract.
 */

/** Relative on-disk cover path → the public URL, or null when there's no cover. */
export function toCoverUrl(coverPath: string | null): string | null {
  return coverPath === null ? null : `/covers/${coverPath}`;
}

export function toBookSummary(row: BookSummaryRow): BookSummary {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors,
    coverUrl: toCoverUrl(row.coverPath),
    firstPublishedYear: row.firstPublishedYear,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
  };
}

function toListItem(row: ListItemRow): ListItem {
  if (row.type === 'book') {
    return { type: 'book', rank: row.rank, blurb: row.blurb, book: toBookSummary(row.book) };
  }
  return { type: 'series', rank: row.rank, blurb: row.blurb, series: row.series };
}

export function toSubjectDetail(row: SubjectWithLists): SubjectDetail {
  return { slug: row.slug, name: row.name, description: row.description, lists: row.lists };
}

export function toListDetail(row: ListReadModel): ListDetail {
  return {
    slug: row.slug,
    title: row.title,
    intro: row.intro,
    subject: row.subject,
    parent: row.parent,
    items: row.items.map(toListItem),
    sublists: row.sublists,
  };
}

export function toBookDetail(row: BookDetailRow): BookDetail {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors,
    description: row.description,
    coverUrl: toCoverUrl(row.coverPath),
    firstPublishedYear: row.firstPublishedYear,
    pageCount: row.pageCount,
    language: row.language,
    subjects: row.subjects,
    series: row.series,
    listAppearances: row.listAppearances,
    related: row.related.map((r) => ({
      slug: r.slug,
      title: r.title,
      coverUrl: toCoverUrl(r.coverPath),
      reason: r.reason,
    })),
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
  };
}

export function toSeriesDetail(row: SeriesDetailRow): SeriesDetail {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    books: row.books.map((b) => ({ ...toBookSummary(b), seriesPosition: b.seriesPosition })),
  };
}
