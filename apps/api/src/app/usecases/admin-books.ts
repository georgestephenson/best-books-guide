import { slugify } from '@bestbooks/shared';
import type {
  AdminBook,
  AdminBookListItem,
  BookRefResponse,
  BookWriteBody,
  OpenLibraryResult,
} from '@bestbooks/shared';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import type {
  AdminBookDetail,
  AdminCatalogueRepository,
} from '../ports/admin-catalogue-repository.js';
import type { Cache } from '../ports/cache.js';
import type { ImageStore } from '../ports/image-store.js';
import type { OpenLibraryClient } from '../ports/open-library-client.js';
import { toCoverUrl } from '../catalogue-view.js';

const OL_SEARCH_TTL_SECONDS = 600; // docs/04: cache OL search ~10m
const OL_SEARCH_LIMIT = 12;

/** Generate a slug from the title, disambiguating on collision (docs/03 §books). */
async function uniqueSlug(
  repo: AdminCatalogueRepository,
  title: string,
  year: number | null,
): Promise<string> {
  const base = slugify(title) || 'book';
  if (!(await repo.slugExists(base))) return base;
  if (year != null) {
    const withYear = `${base}-${year}`;
    if (!(await repo.slugExists(withYear))) return withYear;
  }
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!(await repo.slugExists(candidate))) return candidate;
  }
  throw new ConflictError('could not generate a unique slug for this title');
}

async function resolveAuthorIds(
  repo: AdminCatalogueRepository,
  names: string[],
): Promise<string[]> {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  return Promise.all(cleaned.map((name) => repo.findOrCreateAuthorByName(name)));
}

function toAdminBook(detail: AdminBookDetail): AdminBook {
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    subtitle: detail.subtitle,
    description: detail.description,
    isbn13: detail.isbn13,
    olWorkKey: detail.olWorkKey,
    coverUrl: toCoverUrl(detail.coverPath),
    firstPublishedYear: detail.firstPublishedYear,
    pageCount: detail.pageCount,
    language: detail.language,
    authors: detail.authors,
    subjectIds: detail.subjectIds,
  };
}

/** Proxy an Open Library search, memoised in Redis (docs/04 GET /admin/openlibrary/search). */
export class SearchOpenLibrary {
  constructor(private readonly deps: { ol: OpenLibraryClient; cache: Cache }) {}

  async execute(query: string): Promise<OpenLibraryResult[]> {
    const key = `cache:ol-search:${query.trim().toLowerCase()}`;
    const cached = await this.deps.cache.get(key);
    if (cached) return JSON.parse(cached) as OpenLibraryResult[];
    const results = await this.deps.ol.search(query, OL_SEARCH_LIMIT);
    await this.deps.cache.set(key, JSON.stringify(results), OL_SEARCH_TTL_SECONDS);
    return results;
  }
}

export interface ImportBookDeps {
  repo: AdminCatalogueRepository;
  ol: OpenLibraryClient;
  images: ImageStore;
  coversBaseUrl: string;
}

/** Import a work from Open Library, deduping on the work key (docs/04 POST /admin/books/import). */
export class ImportBook {
  constructor(private readonly deps: ImportBookDeps) {}

  async execute(workKey: string): Promise<BookRefResponse> {
    const existing = await this.deps.repo.findBookByOlWorkKey(workKey);
    if (existing) {
      throw new ConflictError(`already imported as “${existing.title}” (/books/${existing.slug})`);
    }
    const work = await this.deps.ol.fetchWork(workKey);
    if (!work) throw new NotFoundError('Open Library has no work with that key');

    const authorIds = await resolveAuthorIds(this.deps.repo, work.authorNames);
    const slug = await uniqueSlug(this.deps.repo, work.title, work.firstPublishYear);

    let coverPath: string | null = null;
    if (work.coverId != null) {
      const url = `${this.deps.coversBaseUrl}/b/id/${work.coverId}-L.jpg`;
      coverPath = await this.deps.images.saveFromUrl(url, slug);
    }

    return this.deps.repo.createBook({
      title: work.title,
      subtitle: null,
      slug,
      description: work.description,
      isbn13: null,
      olWorkKey: work.workKey,
      coverPath,
      firstPublishedYear: work.firstPublishYear,
      pageCount: null,
      language: 'en',
      authorIds,
      subjectIds: [],
    });
  }
}

export class ListAdminBooks {
  constructor(private readonly repo: AdminCatalogueRepository) {}

  async execute(search: string | undefined): Promise<AdminBookListItem[]> {
    const rows = await this.repo.listBooks(search?.trim() || undefined);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      authorNames: r.authorNames,
      coverUrl: toCoverUrl(r.coverPath),
    }));
  }
}

export class GetAdminBook {
  constructor(private readonly repo: AdminCatalogueRepository) {}

  async execute(id: string): Promise<AdminBook> {
    const book = await this.repo.getAdminBook(id);
    if (!book) throw new NotFoundError('book not found');
    return toAdminBook(book);
  }
}

export class CreateBook {
  constructor(private readonly repo: AdminCatalogueRepository) {}

  async execute(body: BookWriteBody): Promise<BookRefResponse> {
    if (body.isbn13) {
      const clash = await this.repo.findBookByIsbn13(body.isbn13);
      if (clash) throw new ConflictError(`a book with that ISBN already exists (${clash.slug})`);
    }
    const authorIds = await resolveAuthorIds(this.repo, body.authors);
    const slug = await uniqueSlug(this.repo, body.title, body.firstPublishedYear ?? null);
    return this.repo.createBook({
      title: body.title,
      subtitle: body.subtitle ?? null,
      slug,
      description: body.description ?? null,
      isbn13: body.isbn13 ?? null,
      olWorkKey: null,
      coverPath: null,
      firstPublishedYear: body.firstPublishedYear ?? null,
      pageCount: body.pageCount ?? null,
      language: body.language ?? 'en',
      authorIds,
      subjectIds: body.subjectIds,
    });
  }
}

export class UpdateBook {
  constructor(private readonly repo: AdminCatalogueRepository) {}

  async execute(id: string, body: BookWriteBody): Promise<AdminBook> {
    const authorIds = await resolveAuthorIds(this.repo, body.authors);
    const updated = await this.repo.updateBook(id, {
      title: body.title,
      subtitle: body.subtitle ?? null,
      description: body.description ?? null,
      isbn13: body.isbn13 ?? null,
      firstPublishedYear: body.firstPublishedYear ?? null,
      pageCount: body.pageCount ?? null,
      language: body.language ?? 'en',
      authorIds,
      subjectIds: body.subjectIds,
    });
    if (!updated) throw new NotFoundError('book not found');
    return toAdminBook(updated);
  }
}

export class DeleteBook {
  constructor(private readonly repo: AdminCatalogueRepository) {}

  async execute(id: string): Promise<void> {
    const result = await this.repo.deleteBook(id);
    if (result === 'not_found') throw new NotFoundError('book not found');
    if (result === 'in_use') {
      throw new ConflictError('this book appears on one or more lists — remove it from them first');
    }
  }
}
