import {
  API_BASE_PATH,
  type AdminBook,
  type AdminBookListItem,
  type AdminSubject,
  type BookRefResponse,
  type BookWriteBody,
  type OpenLibraryResult,
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

export const adminKeys = {
  books: (search?: string) => ['admin', 'books', search ?? ''] as const,
  book: (id: string) => ['admin', 'book', id] as const,
  subjects: ['admin', 'subjects'] as const,
};
