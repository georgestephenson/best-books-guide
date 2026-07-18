import { slugify } from '@bestbooks/shared';
import type {
  AdminListDetail,
  AdminListSummary,
  ListCreateBody,
  ListUpdateBody,
  SetListItemsBody,
} from '@bestbooks/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import type { AdminCurationRepository, ListItemInput } from '../ports/admin-curation-repository.js';

export class ListAdminLists {
  constructor(private readonly repo: AdminCurationRepository) {}
  execute(): Promise<AdminListSummary[]> {
    return this.repo.listLists();
  }
}

export class CreateList {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(body: ListCreateBody): Promise<{ id: string; slug: string }> {
    const slug = slugify(body.title);
    if (!slug) throw new ValidationError('list title must contain a letter or number');
    return this.repo.createList({
      title: body.title,
      slug,
      subjectId: body.subjectId,
      intro: body.intro ?? null,
    });
  }
}

export class GetAdminList {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(id: string): Promise<AdminListDetail> {
    const list = await this.repo.getList(id);
    if (!list) throw new NotFoundError('list not found');
    return list;
  }
}

export class UpdateList {
  constructor(private readonly repo: AdminCurationRepository) {}

  async execute(id: string, body: ListUpdateBody): Promise<AdminListDetail> {
    // Coerce empty string (the "no parent" <option value="">) to null — otherwise it
    // would be treated as a real id and reach the DB as an invalid uuid.
    const parentListId = body.parentListId || null;

    // Enforce the sublist invariants (docs/03) before writing.
    if (parentListId !== null) {
      if (parentListId === id) throw new ValidationError('a list cannot be its own parent');
      const parent = await this.repo.listMeta(parentListId);
      if (!parent) throw new ValidationError('parent list not found');
      if (parent.parentListId !== null) {
        throw new ValidationError('sublists are one level deep — the parent is already a sublist');
      }
      if (parent.subjectId !== body.subjectId) {
        throw new ValidationError('a sublist must share its parent’s subject');
      }
      const self = await this.repo.listMeta(id);
      if (self?.hasChildren) {
        throw new ValidationError('this list already has sublists, so it cannot become one');
      }
    }

    const updated = await this.repo.updateList(id, {
      title: body.title,
      subjectId: body.subjectId,
      intro: body.intro ?? null,
      isPublished: body.isPublished,
      parentListId,
    });
    if (!updated) throw new NotFoundError('list not found');
    return this.repo.getList(id) as Promise<AdminListDetail>;
  }
}

export class DeleteList {
  constructor(private readonly repo: AdminCurationRepository) {}
  async execute(id: string): Promise<void> {
    const result = await this.repo.deleteList(id);
    if (result === 'not_found') throw new NotFoundError('list not found');
    if (result === 'in_use') {
      throw new ConflictError('this list has sublists — detach or delete them first');
    }
  }
}

export class SetListItems {
  constructor(private readonly repo: AdminCurationRepository) {}

  async execute(id: string, body: SetListItemsBody): Promise<AdminListDetail> {
    const meta = await this.repo.listMeta(id);
    if (!meta) throw new NotFoundError('list not found');

    const seenBooks = new Set<string>();
    const seenSeries = new Set<string>();
    const items: ListItemInput[] = body.items.map((item) => {
      const hasBook = Boolean(item.bookId);
      const hasSeries = Boolean(item.seriesId);
      if (hasBook === hasSeries) {
        throw new ValidationError('each item must be exactly one book or one series');
      }
      if (hasBook) {
        if (seenBooks.has(item.bookId!)) throw new ValidationError('the same book appears twice');
        seenBooks.add(item.bookId!);
      } else {
        if (seenSeries.has(item.seriesId!))
          throw new ValidationError('the same series appears twice');
        seenSeries.add(item.seriesId!);
      }
      return {
        bookId: item.bookId ?? null,
        seriesId: item.seriesId ?? null,
        blurb: item.blurb ?? null,
      };
    });

    await this.repo.setListItems(id, items);
    return this.repo.getList(id) as Promise<AdminListDetail>;
  }
}
