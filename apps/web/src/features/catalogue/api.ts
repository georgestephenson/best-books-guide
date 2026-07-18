import {
  API_BASE_PATH,
  type BookDetail,
  type BookListResponse,
  type ListDetail,
  type SeriesDetail,
  type SubjectDetail,
} from '@bestbooks/shared';
import { apiJson } from '../../lib/api.js';

/**
 * Public catalogue reads (docs/04). All anonymous — no token needed — and consumed
 * through TanStack Query in the pages. Slugs address every public resource.
 */
const V1 = API_BASE_PATH;

export const fetchSubjects = (): Promise<SubjectDetail[]> => apiJson(`${V1}/subjects`);

export const fetchSubject = (slug: string): Promise<SubjectDetail> =>
  apiJson(`${V1}/subjects/${encodeURIComponent(slug)}`);

export const fetchList = (slug: string): Promise<ListDetail> =>
  apiJson(`${V1}/lists/${encodeURIComponent(slug)}`);

export const fetchBook = (slug: string): Promise<BookDetail> =>
  apiJson(`${V1}/books/${encodeURIComponent(slug)}`);

export const fetchSeries = (slug: string): Promise<SeriesDetail> =>
  apiJson(`${V1}/series/${encodeURIComponent(slug)}`);

export const searchBooks = (params: {
  search?: string;
  subject?: string;
  cursor?: string;
}): Promise<BookListResponse> => {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.subject) qs.set('subject', params.subject);
  if (params.cursor) qs.set('cursor', params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiJson(`${V1}/books${suffix}`);
};

/** Query keys — one namespace so cache invalidation stays predictable. */
export const catalogueKeys = {
  subjects: ['catalogue', 'subjects'] as const,
  subject: (slug: string) => ['catalogue', 'subject', slug] as const,
  list: (slug: string) => ['catalogue', 'list', slug] as const,
  book: (slug: string) => ['catalogue', 'book', slug] as const,
  series: (slug: string) => ['catalogue', 'series', slug] as const,
};
