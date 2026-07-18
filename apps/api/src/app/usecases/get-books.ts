import type { BookListQuery, BookListResponse } from '@bestbooks/shared';
import type { CatalogueRepository } from '../ports/catalogue-repository.js';
import { toBookSummary } from '../catalogue-view.js';

const DEFAULT_LIMIT = 20;

/** Paginated book search (trgm title/author) + subject filter (docs/04 GET /books). */
export class GetBooks {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(query: BookListQuery): Promise<BookListResponse> {
    const result = await this.catalogue.searchBooks({
      search: query.search?.trim() || undefined,
      subjectSlug: query.subject,
      limit: query.limit ?? DEFAULT_LIMIT,
      cursor: query.cursor,
    });
    return { items: result.items.map(toBookSummary), nextCursor: result.nextCursor };
  }
}
