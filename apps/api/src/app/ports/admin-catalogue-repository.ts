/** Write-side of the catalogue (docs/04 §Admin). Public reads live in CatalogueRepository. */

export interface SubjectAdminRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
}

export interface BookRef {
  id: string;
  slug: string;
  title: string;
}

export interface CreateBookInput {
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  isbn13: string | null;
  olWorkKey: string | null;
  coverPath: string | null;
  firstPublishedYear: number | null;
  pageCount: number | null;
  language: string;
  authorIds: string[];
  subjectIds: string[];
}

export interface UpdateBookInput {
  title: string;
  subtitle: string | null;
  description: string | null;
  isbn13: string | null;
  firstPublishedYear: number | null;
  pageCount: number | null;
  language: string;
  authorIds: string[];
  subjectIds: string[];
  // Note: coverPath is intentionally not editable here — covers are managed by the
  // import flow, so a manual field edit never clobbers an imported cover.
}

/** A book as the admin editor sees it (all fields, author names for the form). */
export interface AdminBookDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  isbn13: string | null;
  olWorkKey: string | null;
  coverPath: string | null;
  firstPublishedYear: number | null;
  pageCount: number | null;
  language: string;
  authors: { id: string; name: string }[];
  subjectIds: string[];
}

/** A row in the admin catalogue table — id-addressed, with author names for display. */
export interface AdminBookListItem {
  id: string;
  slug: string;
  title: string;
  authorNames: string[];
  coverPath: string | null;
}

/** Result of a delete whose target may be referenced elsewhere (RESTRICT FKs). */
export type DeleteResult = 'ok' | 'not_found' | 'in_use';

export interface AdminCatalogueRepository {
  // --- subjects ---
  listSubjects(): Promise<SubjectAdminRow[]>;
  createSubject(input: {
    slug: string;
    name: string;
    description: string | null;
  }): Promise<SubjectAdminRow>;
  updateSubject(
    id: string,
    patch: { name: string; description: string | null },
  ): Promise<SubjectAdminRow | null>;
  deleteSubject(id: string): Promise<DeleteResult>;
  reorderSubjects(orderedIds: string[]): Promise<void>;

  // --- authors ---
  /** Match an author by its slugified name, creating it if new. Returns the id. */
  findOrCreateAuthorByName(name: string): Promise<string>;

  // --- books ---
  listBooks(search: string | undefined): Promise<AdminBookListItem[]>;
  findBookByOlWorkKey(olWorkKey: string): Promise<BookRef | null>;
  findBookByIsbn13(isbn13: string): Promise<BookRef | null>;
  slugExists(slug: string): Promise<boolean>;
  createBook(input: CreateBookInput): Promise<BookRef>;
  getAdminBook(id: string): Promise<AdminBookDetail | null>;
  updateBook(id: string, patch: UpdateBookInput): Promise<AdminBookDetail | null>;
  deleteBook(id: string): Promise<DeleteResult>;
}
