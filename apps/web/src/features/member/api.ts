import {
  API_BASE_PATH,
  type ListTracking,
  type MyBooks,
  type ReportReviewBody,
  type Review,
  type SetReadingStatusBody,
  type TrackedList,
  type UpsertReviewBody,
  type ViewerBook,
  type ViewerReview,
  type ViewerShelf,
} from '@bestbooks/shared';
import { apiJson } from '../../lib/api.js';

/**
 * Member-feature calls (docs/01 F3–F7). All but the public reviews list carry the
 * caller's access token (attached by lib/api) and hit member-gated routes. Consumed
 * through TanStack Query with optimistic updates in the widgets.
 */
const V1 = API_BASE_PATH;
const enc = encodeURIComponent;
const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

// --- public (anonymous) ---
export const fetchBookReviews = (slug: string): Promise<Review[]> =>
  apiJson(`${V1}/books/${enc(slug)}/reviews`);

// --- shelves (F3) ---
export const fetchViewerBook = (slug: string): Promise<ViewerBook> =>
  apiJson(`${V1}/me/books/${enc(slug)}`);

export const setBookStatus = (slug: string, body: SetReadingStatusBody): Promise<ViewerShelf> =>
  apiJson(`${V1}/me/books/${enc(slug)}/status`, send('PUT', body));

export const removeBookStatus = (slug: string): Promise<void> =>
  apiJson(`${V1}/me/books/${enc(slug)}/status`, send('DELETE'));

export const fetchMyBooks = (): Promise<MyBooks> => apiJson(`${V1}/me/books`);

// --- ratings & reviews (F4/F5) ---
export const upsertReview = (slug: string, body: UpsertReviewBody): Promise<ViewerReview> =>
  apiJson(`${V1}/me/books/${enc(slug)}/review`, send('PUT', body));

export const deleteReview = (slug: string): Promise<void> =>
  apiJson(`${V1}/me/books/${enc(slug)}/review`, send('DELETE'));

export const reportReview = (reviewId: string, body: ReportReviewBody): Promise<void> =>
  apiJson(`${V1}/reviews/${enc(reviewId)}/report`, send('POST', body));

// --- track a list (F7) ---
export const fetchTrackedLists = (): Promise<TrackedList[]> => apiJson(`${V1}/me/lists`);

export const fetchListTracking = (slug: string): Promise<ListTracking> =>
  apiJson(`${V1}/me/lists/${enc(slug)}/tracking`);

export const trackList = (slug: string): Promise<ListTracking> =>
  apiJson(`${V1}/me/lists/${enc(slug)}`, send('PUT'));

export const untrackList = (slug: string): Promise<ListTracking> =>
  apiJson(`${V1}/me/lists/${enc(slug)}`, send('DELETE'));

/** Query keys — one namespace so member-state invalidation stays predictable. */
export const memberKeys = {
  myBooks: ['member', 'my-books'] as const,
  viewerBook: (slug: string) => ['member', 'viewer-book', slug] as const,
  bookReviews: (slug: string) => ['member', 'book-reviews', slug] as const,
  trackedLists: ['member', 'tracked-lists'] as const,
  listTracking: (slug: string) => ['member', 'list-tracking', slug] as const,
};
