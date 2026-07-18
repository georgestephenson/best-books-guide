import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  BookDetail,
  BookListQuery,
  BookListResponse,
  ListDetail,
  SeriesDetail,
  SubjectDetail,
} from '@bestbooks/shared';
import type { GetSubjects } from '../../app/usecases/get-subjects.js';
import type { GetSubject } from '../../app/usecases/get-subject.js';
import type { GetList } from '../../app/usecases/get-list.js';
import type { GetBooks } from '../../app/usecases/get-books.js';
import type { GetBook } from '../../app/usecases/get-book.js';
import type { GetSeries } from '../../app/usecases/get-series.js';

export interface CatalogueRoutesDeps {
  getSubjects: GetSubjects;
  getSubject: GetSubject;
  getList: GetList;
  getBooks: GetBooks;
  getBook: GetBook;
  getSeries: GetSeries;
}

const SlugParams = Type.Object({ slug: Type.String({ minLength: 1, maxLength: 200 }) });

/** Public catalogue endpoints (docs/04), mounted under /api/v1. All are anonymous. */
export function catalogueRoutes(deps: CatalogueRoutesDeps): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get('/subjects', { schema: { response: { 200: Type.Array(SubjectDetail) } } }, async () =>
      deps.getSubjects.execute(),
    );

    app.get(
      '/subjects/:slug',
      { schema: { params: SlugParams, response: { 200: SubjectDetail } } },
      async (request) => deps.getSubject.execute(request.params.slug),
    );

    app.get(
      '/lists/:slug',
      { schema: { params: SlugParams, response: { 200: ListDetail } } },
      async (request) => deps.getList.execute(request.params.slug),
    );

    app.get(
      '/books',
      { schema: { querystring: BookListQuery, response: { 200: BookListResponse } } },
      async (request) => deps.getBooks.execute(request.query),
    );

    app.get(
      '/books/:slug',
      { schema: { params: SlugParams, response: { 200: BookDetail } } },
      async (request) => deps.getBook.execute(request.params.slug),
    );

    app.get(
      '/series/:slug',
      { schema: { params: SlugParams, response: { 200: SeriesDetail } } },
      async (request) => deps.getSeries.execute(request.params.slug),
    );
  };
}
