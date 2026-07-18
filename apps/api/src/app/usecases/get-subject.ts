import type { SubjectDetail } from '@bestbooks/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { CatalogueRepository } from '../ports/catalogue-repository.js';
import { toSubjectDetail } from '../catalogue-view.js';

/** A subject page: the subject + its published lists (docs/04 GET /subjects/{slug}). */
export class GetSubject {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(slug: string): Promise<SubjectDetail> {
    const subject = await this.catalogue.findSubjectBySlug(slug);
    if (!subject) throw new NotFoundError('subject not found');
    return toSubjectDetail(subject);
  }
}
