import { asc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { slugify } from '@bestbooks/shared';
import { ConflictError } from '../../domain/errors.js';
import type {
  AdminBookDetail,
  AdminBookListItem,
  AdminCatalogueRepository,
  BookRef,
  CreateBookInput,
  DeleteResult,
  SubjectAdminRow,
  UpdateBookInput,
} from '../../app/ports/admin-catalogue-repository.js';
import type { Database } from './pool.js';
import { authors, bookAuthors, bookSubjects, books, subjects } from './schema/index.js';

// The transaction handle drizzle hands to the `db.transaction` callback.
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// 23001 restrict_violation — an ON DELETE RESTRICT FK blocked the delete.
function pgCode(err: unknown): string | undefined {
  return (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
}
const isRestrictViolation = (err: unknown): boolean => pgCode(err) === '23001';
const isUniqueViolation = (err: unknown): boolean => pgCode(err) === '23505';

function toSubjectRow(row: typeof subjects.$inferSelect): SubjectAdminRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
  };
}

export class DrizzleAdminCatalogueRepository implements AdminCatalogueRepository {
  constructor(private readonly db: Database) {}

  // --- subjects ---
  async listSubjects(): Promise<SubjectAdminRow[]> {
    const rows = await this.db
      .select()
      .from(subjects)
      .orderBy(asc(subjects.position), asc(subjects.name));
    return rows.map(toSubjectRow);
  }

  async createSubject(input: {
    slug: string;
    name: string;
    description: string | null;
  }): Promise<SubjectAdminRow> {
    // New subjects sort last by default.
    const positionRows = await this.db
      .select({ next: sql<number>`coalesce(max(${subjects.position}), -1) + 1` })
      .from(subjects);
    const next = positionRows[0]?.next ?? 0;
    try {
      const [row] = await this.db
        .insert(subjects)
        .values({ ...input, position: next })
        .returning();
      return toSubjectRow(row!);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('a subject with that name already exists');
      throw err;
    }
  }

  async updateSubject(
    id: string,
    patch: { name: string; description: string | null },
  ): Promise<SubjectAdminRow | null> {
    const [row] = await this.db
      .update(subjects)
      .set(patch)
      .where(eq(subjects.id, id))
      .returning();
    return row ? toSubjectRow(row) : null;
  }

  async deleteSubject(id: string): Promise<DeleteResult> {
    try {
      const deleted = await this.db.delete(subjects).where(eq(subjects.id, id)).returning({ id: subjects.id });
      return deleted.length > 0 ? 'ok' : 'not_found';
    } catch (err) {
      if (isRestrictViolation(err)) return 'in_use';
      throw err;
    }
  }

  async reorderSubjects(orderedIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const [position, id] of orderedIds.entries()) {
        await tx.update(subjects).set({ position }).where(eq(subjects.id, id));
      }
    });
  }

  // --- authors ---
  async findOrCreateAuthorByName(name: string): Promise<string> {
    const slug = slugify(name) || 'author';
    const [row] = await this.db
      .insert(authors)
      .values({ name, slug })
      .onConflictDoUpdate({ target: authors.slug, set: { name: sql`excluded.name` } })
      .returning({ id: authors.id });
    return row!.id;
  }

  // --- books ---
  async listBooks(search: string | undefined): Promise<AdminBookListItem[]> {
    const rows = await this.db
      .select({ id: books.id, slug: books.slug, title: books.title, coverPath: books.coverPath })
      .from(books)
      .where(search ? ilike(books.title, `%${search}%`) : undefined)
      .orderBy(asc(books.title))
      .limit(200);
    if (rows.length === 0) return [];
    const authorRows = await this.db
      .select({ bookId: bookAuthors.bookId, name: authors.name })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .where(
        inArray(
          bookAuthors.bookId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(bookAuthors.position));
    const byBook = new Map<string, string[]>();
    for (const a of authorRows) {
      const list = byBook.get(a.bookId) ?? [];
      list.push(a.name);
      byBook.set(a.bookId, list);
    }
    return rows.map((r) => ({ ...r, authorNames: byBook.get(r.id) ?? [] }));
  }

  async findBookByOlWorkKey(olWorkKey: string): Promise<BookRef | null> {
    const [row] = await this.db
      .select({ id: books.id, slug: books.slug, title: books.title })
      .from(books)
      .where(eq(books.olWorkKey, olWorkKey))
      .limit(1);
    return row ?? null;
  }

  async findBookByIsbn13(isbn13: string): Promise<BookRef | null> {
    const [row] = await this.db
      .select({ id: books.id, slug: books.slug, title: books.title })
      .from(books)
      .where(eq(books.isbn13, isbn13))
      .limit(1);
    return row ?? null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.slug, slug))
      .limit(1);
    return Boolean(row);
  }

  async createBook(input: CreateBookInput): Promise<BookRef> {
    try {
      return await this.insertBook(input);
    } catch (err) {
      // A racing slug/isbn/work-key collision (the use-case pre-checks, so this is rare).
      if (isUniqueViolation(err)) throw new ConflictError('a book with those details already exists');
      throw err;
    }
  }

  private async insertBook(input: CreateBookInput): Promise<BookRef> {
    return this.db.transaction(async (tx) => {
      const [book] = await tx
        .insert(books)
        .values({
          title: input.title,
          subtitle: input.subtitle,
          slug: input.slug,
          description: input.description,
          isbn13: input.isbn13,
          olWorkKey: input.olWorkKey,
          coverPath: input.coverPath,
          firstPublishedYear: input.firstPublishedYear,
          pageCount: input.pageCount,
          language: input.language,
        })
        .returning({ id: books.id, slug: books.slug, title: books.title });
      await this.replaceLinks(tx, book!.id, input.authorIds, input.subjectIds);
      return book!;
    });
  }

  async getAdminBook(id: string): Promise<AdminBookDetail | null> {
    const [book] = await this.db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!book) return null;
    const authorRows = await this.db
      .select({ id: authors.id, name: authors.name })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .where(eq(bookAuthors.bookId, id))
      .orderBy(asc(bookAuthors.position));
    const subjectRows = await this.db
      .select({ subjectId: bookSubjects.subjectId })
      .from(bookSubjects)
      .where(eq(bookSubjects.bookId, id));
    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      isbn13: book.isbn13,
      olWorkKey: book.olWorkKey,
      coverPath: book.coverPath,
      firstPublishedYear: book.firstPublishedYear,
      pageCount: book.pageCount,
      language: book.language,
      authors: authorRows,
      subjectIds: subjectRows.map((r) => r.subjectId),
    };
  }

  async updateBook(id: string, patch: UpdateBookInput): Promise<AdminBookDetail | null> {
    const updated = await this.db.transaction(async (tx) => {
      const [book] = await tx
        .update(books)
        .set({
          title: patch.title,
          subtitle: patch.subtitle,
          description: patch.description,
          isbn13: patch.isbn13,
          firstPublishedYear: patch.firstPublishedYear,
          pageCount: patch.pageCount,
          language: patch.language,
        })
        .where(eq(books.id, id))
        .returning({ id: books.id });
      if (!book) return false;
      await this.replaceLinks(tx, id, patch.authorIds, patch.subjectIds);
      return true;
    });
    return updated ? this.getAdminBook(id) : null;
  }

  async deleteBook(id: string): Promise<DeleteResult> {
    try {
      const deleted = await this.db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
      return deleted.length > 0 ? 'ok' : 'not_found';
    } catch (err) {
      if (isRestrictViolation(err)) return 'in_use';
      throw err;
    }
  }

  /** Rewrite a book's author/subject join rows to exactly the given ids (dedup, ordered). */
  private async replaceLinks(
    tx: Tx,
    bookId: string,
    authorIds: string[],
    subjectIds: string[],
  ): Promise<void> {
    await tx.delete(bookAuthors).where(eq(bookAuthors.bookId, bookId));
    await tx.delete(bookSubjects).where(eq(bookSubjects.bookId, bookId));
    const uniqueAuthors = [...new Set(authorIds)];
    if (uniqueAuthors.length > 0) {
      await tx
        .insert(bookAuthors)
        .values(uniqueAuthors.map((authorId, position) => ({ bookId, authorId, position })));
    }
    const uniqueSubjects = [...new Set(subjectIds)];
    if (uniqueSubjects.length > 0) {
      await tx.insert(bookSubjects).values(uniqueSubjects.map((subjectId) => ({ bookId, subjectId })));
    }
  }
}
