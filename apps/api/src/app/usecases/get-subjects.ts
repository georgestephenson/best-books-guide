import type { SubjectDetail } from '@bestbooks/shared';
import type { CatalogueRepository } from '../ports/catalogue-repository.js';
import { toSubjectDetail } from '../catalogue-view.js';

/** The browse home: ordered subjects with their published lists (docs/04 GET /subjects). */
export class GetSubjects {
  constructor(private readonly catalogue: CatalogueRepository) {}

  async execute(): Promise<SubjectDetail[]> {
    const subjects = await this.catalogue.listPublishedSubjects();
    return subjects.map(toSubjectDetail);
  }
}
