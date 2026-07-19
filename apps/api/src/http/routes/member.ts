import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  ListTracking,
  MyBooks,
  ReportReviewBody,
  SetReadingStatusBody,
  TrackedList,
  UpsertReviewBody,
  ViewerBook,
  ViewerReview,
  ViewerShelf,
} from '@bestbooks/shared';
import type { AuthGuards } from '../auth-guards.js';
import type {
  GetMyBooks,
  RemoveReadingStatus,
  SetReadingStatus,
} from '../../app/usecases/reading-status.js';
import type {
  DeleteReview,
  GetViewerBook,
  ReportReview,
  UpsertReview,
} from '../../app/usecases/reviews.js';
import type {
  GetListTracking,
  GetTrackedLists,
  TrackList,
  UntrackList,
} from '../../app/usecases/tracked-lists.js';

export interface MemberRoutesDeps {
  guards: AuthGuards;
  getMyBooks: GetMyBooks;
  setReadingStatus: SetReadingStatus;
  removeReadingStatus: RemoveReadingStatus;
  getViewerBook: GetViewerBook;
  upsertReview: UpsertReview;
  deleteReview: DeleteReview;
  reportReview: ReportReview;
  getTrackedLists: GetTrackedLists;
  trackList: TrackList;
  untrackList: UntrackList;
  getListTracking: GetListTracking;
}

const SlugParams = Type.Object({ slug: Type.String({ minLength: 1, maxLength: 200 }) });
const ReviewIdParams = Type.Object({ reviewId: Type.String({ minLength: 1, maxLength: 40 }) });

/**
 * Member-feature endpoints (docs/04 §Member): shelves (F3), ratings/reviews (F4/F5),
 * reporting (F5), and track-a-list (F7). Mounted at /api/v1. Guards are per-route
 * because they differ: everything needs a member token, and posting a *written* review
 * additionally needs a verified email (`requireVerified`, docs/01 F2).
 */
export function memberRoutes(deps: MemberRoutesDeps): FastifyPluginAsyncTypebox {
  return async (app) => {
    // --- shelves (F3) ---
    app.get(
      '/me/books',
      { preHandler: deps.guards.requireMember, schema: { response: { 200: MyBooks } } },
      async (request) => deps.getMyBooks.execute(request.user!.id),
    );

    app.get(
      '/me/books/:slug',
      {
        preHandler: deps.guards.requireMember,
        schema: { params: SlugParams, response: { 200: ViewerBook } },
      },
      async (request) => deps.getViewerBook.execute(request.user!.id, request.params.slug),
    );

    app.put(
      '/me/books/:slug/status',
      {
        preHandler: deps.guards.requireMember,
        schema: { params: SlugParams, body: SetReadingStatusBody, response: { 200: ViewerShelf } },
      },
      async (request) =>
        deps.setReadingStatus.execute(request.user!.id, request.params.slug, request.body),
    );

    app.delete(
      '/me/books/:slug/status',
      { preHandler: deps.guards.requireMember, schema: { params: SlugParams } },
      async (request, reply) => {
        await deps.removeReadingStatus.execute(request.user!.id, request.params.slug);
        return reply.status(204).send();
      },
    );

    // --- ratings & reviews (F4/F5) — writing a review needs a verified email ---
    app.put(
      '/me/books/:slug/review',
      {
        preHandler: deps.guards.requireVerified,
        schema: { params: SlugParams, body: UpsertReviewBody, response: { 200: ViewerReview } },
      },
      async (request) =>
        deps.upsertReview.execute(request.user!.id, request.params.slug, request.body),
    );

    app.delete(
      '/me/books/:slug/review',
      { preHandler: deps.guards.requireMember, schema: { params: SlugParams } },
      async (request, reply) => {
        await deps.deleteReview.execute(request.user!.id, request.params.slug);
        return reply.status(204).send();
      },
    );

    app.post(
      '/reviews/:reviewId/report',
      {
        preHandler: deps.guards.requireMember,
        schema: { params: ReviewIdParams, body: ReportReviewBody },
      },
      async (request, reply) => {
        await deps.reportReview.execute(request.params.reviewId, request.user!.id, request.body);
        return reply.status(204).send();
      },
    );

    // --- track a list (F7) ---
    app.get(
      '/me/lists',
      {
        preHandler: deps.guards.requireMember,
        schema: { response: { 200: Type.Array(TrackedList) } },
      },
      async (request) => deps.getTrackedLists.execute(request.user!.id),
    );

    app.get(
      '/me/lists/:slug/tracking',
      {
        preHandler: deps.guards.requireMember,
        schema: { params: SlugParams, response: { 200: ListTracking } },
      },
      async (request) => deps.getListTracking.execute(request.user!.id, request.params.slug),
    );

    app.put(
      '/me/lists/:slug',
      {
        preHandler: deps.guards.requireMember,
        schema: { params: SlugParams, response: { 200: ListTracking } },
      },
      async (request) => deps.trackList.execute(request.user!.id, request.params.slug),
    );

    app.delete(
      '/me/lists/:slug',
      {
        preHandler: deps.guards.requireMember,
        schema: { params: SlugParams, response: { 200: ListTracking } },
      },
      async (request) => deps.untrackList.execute(request.user!.id, request.params.slug),
    );
  };
}
