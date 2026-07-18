import type { SeriesDetail } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { CatalogueRepository } from '../ports/catalogue-repository.js';
import { toSeriesDetail } from '../catalogue-view.js';

/** A series page: the series + its books in reading order (docs/04 GET /series/{slug}). */
export class GetSeries {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(slug: string): Promise<SeriesDetail> {
    const series = await this.catalogue.findSeriesBySlug(slug);
    if (!series) throw new NotFoundError('series not found');
    return toSeriesDetail(series);
  }
}
