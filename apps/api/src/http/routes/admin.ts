import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AdminBook,
  AdminBookListItem,
  AdminSubject,
  BookRefResponse,
  BookWriteBody,
  ImportBookBody,
  OpenLibraryResult,
  OpenLibrarySearchQuery,
  ReorderSubjectsBody,
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
}

const IdParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 40 }) });
const BookListQuery = Type.Object({ search: Type.Optional(Type.String({ maxLength: 200 })) });

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
  };
}
