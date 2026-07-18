import { slugify } from '@bestbooks/shared';
import type { AdminSubject, SubjectWriteBody } from '@bestbooks/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import type {
  AdminCatalogueRepository,
  SubjectAdminRow,
} from '../ports/admin-catalogue-repository.js';

function toAdminSubject(row: SubjectAdminRow): AdminSubject {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
  };
}

export class ListSubjects {
  constructor(private readonly repo: AdminCatalogueRepository) {}
  async execute(): Promise<AdminSubject[]> {
    return (await this.repo.listSubjects()).map(toAdminSubject);
  }
}

export class CreateSubject {
  constructor(private readonly repo: AdminCatalogueRepository) {}
  async execute(body: SubjectWriteBody): Promise<AdminSubject> {
    const slug = slugify(body.name);
    if (!slug) throw new ValidationError('subject name must contain a letter or number');
    const row = await this.repo.createSubject({
      slug,
      name: body.name,
      description: body.description ?? null,
    });
    return toAdminSubject(row);
  }
}

export class UpdateSubject {
  constructor(private readonly repo: AdminCatalogueRepository) {}
  async execute(id: string, body: SubjectWriteBody): Promise<AdminSubject> {
    // Slug is immutable once created (docs/03) — only name/description change here.
    const row = await this.repo.updateSubject(id, {
      name: body.name,
      description: body.description ?? null,
    });
    if (!row) throw new NotFoundError('subject not found');
    return toAdminSubject(row);
  }
}

export class DeleteSubject {
  constructor(private readonly repo: AdminCatalogueRepository) {}
  async execute(id: string): Promise<void> {
    const result = await this.repo.deleteSubject(id);
    if (result === 'not_found') throw new NotFoundError('subject not found');
    if (result === 'in_use') {
      throw new ConflictError('this subject still has lists — move or delete them first');
    }
  }
}

export class ReorderSubjects {
  constructor(private readonly repo: AdminCatalogueRepository) {}
  async execute(orderedIds: string[]): Promise<AdminSubject[]> {
    await this.repo.reorderSubjects(orderedIds);
    return (await this.repo.listSubjects()).map(toAdminSubject);
  }
}
