import {
  API_BASE_PATH,
  type AdminBook,
  type AdminBookListItem,
  type AdminListDetail,
  type AdminListSummary,
  type AdminSeriesDetail,
  type AdminSeriesSummary,
  type AdminSubject,
  type BookRefResponse,
  type BookWriteBody,
  type HideReviewBody,
  type ListCreateBody,
  type ListUpdateBody,
  type OpenLibraryResult,
  type ReviewReport,
  type SeriesWriteBody,
  type SetListItemsBody,
  type SetSeriesBooksBody,
  type SubjectWriteBody,
} from '@bestbooks/shared';
import { apiJson } from '../../lib/api.js';

// All admin calls carry the caller's access token automatically (lib/api attaches it)
// and hit /api/v1/admin, which the API gates behind the admin role.
const ADMIN = `${API_BASE_PATH}/admin`;

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const olSearch = (q: string): Promise<OpenLibraryResult[]> =>
  apiJson(`${ADMIN}/openlibrary/search?q=${encodeURIComponent(q)}`);

export const importBook = (workKey: string): Promise<BookRefResponse> =>
  apiJson(`${ADMIN}/books/import`, send('POST', { workKey }));

export const listAdminBooks = (search?: string): Promise<AdminBookListItem[]> =>
  apiJson(`${ADMIN}/books${search ? `?search=${encodeURIComponent(search)}` : ''}`);

export const getAdminBook = (id: string): Promise<AdminBook> => apiJson(`${ADMIN}/books/${id}`);

export const createBook = (body: BookWriteBody): Promise<BookRefResponse> =>
  apiJson(`${ADMIN}/books`, send('POST', body));

export const updateBook = (id: string, body: BookWriteBody): Promise<AdminBook> =>
  apiJson(`${ADMIN}/books/${id}`, send('PATCH', body));

export const deleteBook = (id: string): Promise<void> =>
  apiJson(`${ADMIN}/books/${id}`, send('DELETE'));

export const listSubjects = (): Promise<AdminSubject[]> => apiJson(`${ADMIN}/subjects`);

export const createSubject = (body: SubjectWriteBody): Promise<AdminSubject> =>
  apiJson(`${ADMIN}/subjects`, send('POST', body));

export const updateSubject = (id: string, body: SubjectWriteBody): Promise<AdminSubject> =>
  apiJson(`${ADMIN}/subjects/${id}`, send('PATCH', body));

export const deleteSubject = (id: string): Promise<void> =>
  apiJson(`${ADMIN}/subjects/${id}`, send('DELETE'));

export const reorderSubjects = (orderedIds: string[]): Promise<AdminSubject[]> =>
  apiJson(`${ADMIN}/subjects/reorder`, send('PUT', { orderedIds }));

// --- lists ---
export const listAdminLists = (): Promise<AdminListSummary[]> => apiJson(`${ADMIN}/lists`);
export const createList = (body: ListCreateBody): Promise<{ id: string; slug: string }> =>
  apiJson(`${ADMIN}/lists`, send('POST', body));
export const getAdminList = (id: string): Promise<AdminListDetail> =>
  apiJson(`${ADMIN}/lists/${id}`);
export const updateList = (id: string, body: ListUpdateBody): Promise<AdminListDetail> =>
  apiJson(`${ADMIN}/lists/${id}`, send('PATCH', body));
export const deleteList = (id: string): Promise<void> =>
  apiJson(`${ADMIN}/lists/${id}`, send('DELETE'));
export const setListItems = (id: string, body: SetListItemsBody): Promise<AdminListDetail> =>
  apiJson(`${ADMIN}/lists/${id}/items`, send('PUT', body));

// --- series ---
export const listAdminSeries = (): Promise<AdminSeriesSummary[]> => apiJson(`${ADMIN}/series`);
export const createSeries = (body: SeriesWriteBody): Promise<{ id: string; slug: string }> =>
  apiJson(`${ADMIN}/series`, send('POST', body));
export const getAdminSeries = (id: string): Promise<AdminSeriesDetail> =>
  apiJson(`${ADMIN}/series/${id}`);
export const updateSeries = (id: string, body: SeriesWriteBody): Promise<AdminSeriesDetail> =>
  apiJson(`${ADMIN}/series/${id}`, send('PATCH', body));
export const deleteSeries = (id: string): Promise<void> =>
  apiJson(`${ADMIN}/series/${id}`, send('DELETE'));
export const setSeriesBooks = (id: string, body: SetSeriesBooksBody): Promise<AdminSeriesDetail> =>
  apiJson(`${ADMIN}/series/${id}/books`, send('PUT', body));

// --- moderation (F5/F6) ---
export const listReviewReports = (): Promise<ReviewReport[]> => apiJson(`${ADMIN}/reviews/reports`);
export const hideReview = (reviewId: string, body: HideReviewBody): Promise<void> =>
  apiJson(`${ADMIN}/reviews/${reviewId}/hide`, send('POST', body));
export const unhideReview = (reviewId: string): Promise<void> =>
  apiJson(`${ADMIN}/reviews/${reviewId}/unhide`, send('POST'));
export const resolveReport = (reportId: string): Promise<void> =>
  apiJson(`${ADMIN}/reports/${reportId}/resolve`, send('POST'));

export const moderationKeys = {
  reports: ['admin', 'moderation', 'reports'] as const,
};

export const curationKeys = {
  lists: ['admin', 'lists'] as const,
  list: (id: string) => ['admin', 'list', id] as const,
  series: ['admin', 'series-list'] as const,
  seriesItem: (id: string) => ['admin', 'series', id] as const,
};

export const adminKeys = {
  books: (search?: string) => ['admin', 'books', search ?? ''] as const,
  book: (id: string) => ['admin', 'book', id] as const,
  subjects: ['admin', 'subjects'] as const,
};
