import { slugify } from '@bestbooks/shared';
import type {
  AdminSeriesDetail,
  AdminSeriesSummary,
  SeriesWriteBody,
  SetSeriesBooksBody,
} from '@bestbooks/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import type { AdminCurationRepository } from '../ports/admin-curation-repository.js';

export class ListAdminSeries {
  constructor(private readonly repo: AdminCurationRepository) {}
  execute(): Promise<AdminSeriesSummary[]> {
    return this.repo.listSeries();
  }
}

export class CreateSeries {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(body: SeriesWriteBody): Promise<{ id: string; slug: string }> {
    const slug = slugify(body.title);
    if (!slug) throw new ValidationError('series title must contain a letter or number');
    return this.repo.createSeries({
      title: body.title,
      slug,
      description: body.description ?? null,
    });
  }
}

export class GetAdminSeries {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(id: string): Promise<AdminSeriesDetail> {
    const s = await this.repo.getSeries(id);
    if (!s) throw new NotFoundError('series not found');
    return s;
  }
}

export class UpdateSeries {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(id: string, body: SeriesWriteBody): Promise<AdminSeriesDetail> {
    const updated = await this.repo.updateSeries(id, {
      title: body.title,
      description: body.description ?? null,
    });
    if (!updated) throw new NotFoundError('series not found');
    return this.repo.getSeries(id) as Promise<AdminSeriesDetail>;
  }
}

export class DeleteSeries {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(id: string): Promise<void> {
    const result = await this.repo.deleteSeries(id);
    if (result === 'not_found') throw new NotFoundError('series not found');
    if (result === 'in_use') {
      throw new ConflictError('this series appears on a list — remove it from the list first');
    }
  }
}

export class SetSeriesBooks {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(id: string, body: SetSeriesBooksBody): Promise<AdminSeriesDetail> {
    const existing = await this.repo.getSeries(id);
    if (!existing) throw new NotFoundError('series not found');
    await this.repo.setSeriesBooks(id, body.bookIds);
    return this.repo.getSeries(id) as Promise<AdminSeriesDetail>;
  }
}
