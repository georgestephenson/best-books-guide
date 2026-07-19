import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AdminBook,
  AdminBookListItem,
  AdminListDetail,
  AdminListSummary,
  AdminSeriesDetail,
  AdminSeriesSummary,
  AdminSubject,
  BookRefResponse,
  BookWriteBody,
  HideReviewBody,
  ImportBookBody,
  ListCreateBody,
  ListUpdateBody,
  OpenLibraryResult,
  OpenLibrarySearchQuery,
  ReorderSubjectsBody,
  ReviewReport,
  SeriesWriteBody,
  SetListItemsBody,
  SetSeriesBooksBody,
  SubjectWriteBody,
} from '@bestbooks/shared';
import type { AuthGuards } from '../auth-guards.js';
import type {
  CreateBook,
  DeleteBook,
  GetAdminBook,
  ImportBook,
  ListAdminBooks,
  SearchOpenLibrary,
  UpdateBook,
} from '../../app/usecases/admin-books.js';
import type {
  CreateSubject,
  DeleteSubject,
  ListSubjects,
  ReorderSubjects,
  UpdateSubject,
} from '../../app/usecases/admin-subjects.js';
import type {
  CreateList,
  DeleteList,
  GetAdminList,
  ListAdminLists,
  SetListItems,
  UpdateList,
} from '../../app/usecases/admin-lists.js';
import type {
  CreateSeries,
  DeleteSeries,
  GetAdminSeries,
  ListAdminSeries,
  SetSeriesBooks,
  UpdateSeries,
} from '../../app/usecases/admin-series.js';
import type {
  HideReview,
  ListReviewReports,
  ResolveReport,
  UnhideReview,
} from '../../app/usecases/moderation.js';

export interface AdminRoutesDeps {
  guards: AuthGuards;
  searchOpenLibrary: SearchOpenLibrary;
  importBook: ImportBook;
  listBooks: ListAdminBooks;
  createBook: CreateBook;
  getBook: GetAdminBook;
  updateBook: UpdateBook;
  deleteBook: DeleteBook;
  listSubjects: ListSubjects;
  createSubject: CreateSubject;
  updateSubject: UpdateSubject;
  deleteSubject: DeleteSubject;
  reorderSubjects: ReorderSubjects;
  listLists: ListAdminLists;
  createList: CreateList;
  getList: GetAdminList;
  updateList: UpdateList;
  deleteList: DeleteList;
  setListItems: SetListItems;
  listSeries: ListAdminSeries;
  createSeries: CreateSeries;
  getSeries: GetAdminSeries;
  updateSeries: UpdateSeries;
  deleteSeries: DeleteSeries;
  setSeriesBooks: SetSeriesBooks;
  listReviewReports: ListReviewReports;
  hideReview: HideReview;
  unhideReview: UnhideReview;
  resolveReport: ResolveReport;
}

const IdParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 40 }) });
const ReviewIdParams = Type.Object({ reviewId: Type.String({ minLength: 1, maxLength: 40 }) });
const ReportIdParams = Type.Object({ reportId: Type.String({ minLength: 1, maxLength: 40 }) });
const BookListQuery = Type.Object({ search: Type.Optional(Type.String({ maxLength: 200 })) });
const IdSlug = Type.Object({ id: Type.String(), slug: Type.String() });

/**
 * Admin catalogue endpoints (docs/04 §Admin), mounted under /api/v1/admin. Every
 * route in this plugin requires the admin role — enforced once by a preHandler hook
 * on the encapsulated context rather than repeated per route.
 */
export function adminRoutes(deps: AdminRoutesDeps): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.addHook('preHandler', deps.guards.requireAdmin);

    // --- Open Library ---
    app.get(
      '/openlibrary/search',
      {
        schema: {
          querystring: OpenLibrarySearchQuery,
          response: { 200: Type.Array(OpenLibraryResult) },
        },
      },
      async (request) => deps.searchOpenLibrary.execute(request.query.q),
    );

    app.post(
      '/books/import',
      { schema: { body: ImportBookBody, response: { 201: BookRefResponse } } },
      async (request, reply) => {
        const book = await deps.importBook.execute(request.body.workKey);
        return reply.status(201).send(book);
      },
    );

    // --- books ---
    app.get(
      '/books',
      { schema: { querystring: BookListQuery, response: { 200: Type.Array(AdminBookListItem) } } },
      async (request) => deps.listBooks.execute(request.query.search),
    );

    app.post(
      '/books',
      { schema: { body: BookWriteBody, response: { 201: BookRefResponse } } },
      async (request, reply) => {
        const book = await deps.createBook.execute(request.body);
        return reply.status(201).send(book);
      },
    );

    app.get(
      '/books/:id',
      { schema: { params: IdParams, response: { 200: AdminBook } } },
      async (request) => deps.getBook.execute(request.params.id),
    );

    app.patch(
      '/books/:id',
      { schema: { params: IdParams, body: BookWriteBody, response: { 200: AdminBook } } },
      async (request) => deps.updateBook.execute(request.params.id, request.body),
    );

    app.delete('/books/:id', { schema: { params: IdParams } }, async (request, reply) => {
      await deps.deleteBook.execute(request.params.id);
      return reply.status(204).send();
    });

    // --- subjects ---
    app.get('/subjects', { schema: { response: { 200: Type.Array(AdminSubject) } } }, async () =>
      deps.listSubjects.execute(),
    );

    app.post(
      '/subjects',
      { schema: { body: SubjectWriteBody, response: { 201: AdminSubject } } },
      async (request, reply) => {
        const subject = await deps.createSubject.execute(request.body);
        return reply.status(201).send(subject);
      },
    );

    app.put(
      '/subjects/reorder',
      { schema: { body: ReorderSubjectsBody, response: { 200: Type.Array(AdminSubject) } } },
      async (request) => deps.reorderSubjects.execute(request.body.orderedIds),
    );

    app.patch(
      '/subjects/:id',
      { schema: { params: IdParams, body: SubjectWriteBody, response: { 200: AdminSubject } } },
      async (request) => deps.updateSubject.execute(request.params.id, request.body),
    );

    app.delete('/subjects/:id', { schema: { params: IdParams } }, async (request, reply) => {
      await deps.deleteSubject.execute(request.params.id);
      return reply.status(204).send();
    });

    // --- lists ---
    app.get('/lists', { schema: { response: { 200: Type.Array(AdminListSummary) } } }, async () =>
      deps.listLists.execute(),
    );

    app.post(
      '/lists',
      { schema: { body: ListCreateBody, response: { 201: IdSlug } } },
      async (request, reply) => reply.status(201).send(await deps.createList.execute(request.body)),
    );

    app.get(
      '/lists/:id',
      { schema: { params: IdParams, response: { 200: AdminListDetail } } },
      async (request) => deps.getList.execute(request.params.id),
    );

    app.patch(
      '/lists/:id',
      { schema: { params: IdParams, body: ListUpdateBody, response: { 200: AdminListDetail } } },
      async (request) => deps.updateList.execute(request.params.id, request.body),
    );

    app.put(
      '/lists/:id/items',
      { schema: { params: IdParams, body: SetListItemsBody, response: { 200: AdminListDetail } } },
      async (request) => deps.setListItems.execute(request.params.id, request.body),
    );

    app.delete('/lists/:id', { schema: { params: IdParams } }, async (request, reply) => {
      await deps.deleteList.execute(request.params.id);
      return reply.status(204).send();
    });

    // --- series ---
    app.get(
      '/series',
      { schema: { response: { 200: Type.Array(AdminSeriesSummary) } } },
      async () => deps.listSeries.execute(),
    );

    app.post(
      '/series',
      { schema: { body: SeriesWriteBody, response: { 201: IdSlug } } },
      async (request, reply) =>
        reply.status(201).send(await deps.createSeries.execute(request.body)),
    );

    app.get(
      '/series/:id',
      { schema: { params: IdParams, response: { 200: AdminSeriesDetail } } },
      async (request) => deps.getSeries.execute(request.params.id),
    );

    app.patch(
      '/series/:id',
      { schema: { params: IdParams, body: SeriesWriteBody, response: { 200: AdminSeriesDetail } } },
      async (request) => deps.updateSeries.execute(request.params.id, request.body),
    );

    app.put(
      '/series/:id/books',
      {
        schema: {
          params: IdParams,
          body: SetSeriesBooksBody,
          response: { 200: AdminSeriesDetail },
        },
      },
      async (request) => deps.setSeriesBooks.execute(request.params.id, request.body),
    );

    app.delete('/series/:id', { schema: { params: IdParams } }, async (request, reply) => {
      await deps.deleteSeries.execute(request.params.id);
      return reply.status(204).send();
    });

    // --- moderation (F5/F6): the reported-review queue ---
    app.get(
      '/reviews/reports',
      { schema: { response: { 200: Type.Array(ReviewReport) } } },
      async () => deps.listReviewReports.execute(),
    );

    app.post(
      '/reviews/:reviewId/hide',
      { schema: { params: ReviewIdParams, body: HideReviewBody } },
      async (request, reply) => {
        await deps.hideReview.execute(request.params.reviewId, request.user!.id, request.body);
        return reply.status(204).send();
      },
    );

    app.post(
      '/reviews/:reviewId/unhide',
      { schema: { params: ReviewIdParams } },
      async (request, reply) => {
        await deps.unhideReview.execute(request.params.reviewId);
        return reply.status(204).send();
      },
    );

    app.post(
      '/reports/:reportId/resolve',
      { schema: { params: ReportIdParams } },
      async (request, reply) => {
        await deps.resolveReport.execute(request.params.reportId, request.user!.id);
        return reply.status(204).send();
      },
    );
  };
}
