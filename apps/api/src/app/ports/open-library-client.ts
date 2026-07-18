/** A search hit from Open Library (docs/04 GET /admin/openlibrary/search). */
export interface OpenLibraryDoc {
  /** Work key, normalised without the `/works/` prefix, e.g. `OL45804W`. */
  workKey: string;
  title: string;
  authorNames: string[];
  firstPublishYear: number | null;
  /** Open Library cover id, if the work has a cover. */
  coverId: number | null;
}

/** Full work metadata for an import (docs/04 POST /admin/books/import). */
export interface OpenLibraryWork {
  workKey: string;
  title: string;
  description: string | null;
  authorNames: string[];
  firstPublishYear: number | null;
  coverId: number | null;
  subjects: string[];
}

/**
 * Read-only client for Open Library — the catalogue import source (docs/01 F6). Kept
 * behind a port so the network dependency is swappable and, crucially, so tests run
 * against recorded fixtures instead of the live API ([08] M3 slice 5).
 */
export interface OpenLibraryClient {
  search(query: string, limit: number): Promise<OpenLibraryDoc[]>;
  /** Full work by key, or null if Open Library doesn't know it. */
  fetchWork(workKey: string): Promise<OpenLibraryWork | null>;
}
