import type { ListDetail } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { CatalogueRepository } from '../ports/catalogue-repository.js';
import { toListDetail } from '../catalogue-view.js';

/**
 * A list page: ranked items (book or series) + sublists (docs/04 GET /lists/{slug}).
 * The repository only returns publicly-visible lists, so an unpublished list (or a
 * sublist whose parent is unpublished) surfaces here as a 404 — existence is private.
 */
export class GetList {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(slug: string): Promise<ListDetail> {
    const list = await this.catalogue.findPublishedListBySlug(slug);
    if (!list) throw new NotFoundError('list not found');
    return toListDetail(list);
  }
}
