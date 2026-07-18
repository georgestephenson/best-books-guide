import type { BookDetail } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { CatalogueRepository } from '../ports/catalogue-repository.js';
import { toBookDetail } from '../catalogue-view.js';

/** A book page: metadata, series, list appearances, related strip (docs/04 GET /books/{slug}). */
export class GetBook {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(slug: string): Promise<BookDetail> {
    const book = await this.catalogue.findBookBySlug(slug);
    if (!book) throw new NotFoundError('book not found');
    return toBookDetail(book);
  }
}
