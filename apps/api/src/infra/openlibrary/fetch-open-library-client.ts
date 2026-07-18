import type {
  OpenLibraryClient,
  OpenLibraryDoc,
  OpenLibraryWork,
} from '../../app/ports/open-library-client.js';

// Minimal shapes for the slices of the OL JSON we actually read (their responses
// carry far more). Everything is optional — OL is inconsistent field to field.
interface SearchResponse {
  docs?: {
    key?: string;
    title?: string;
    author_name?: string[];
    first_publish_year?: number;
    cover_i?: number;
  }[];
}
interface WorkResponse {
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
  authors?: { author?: { key?: string } }[];
}
interface AuthorResponse {
  name?: string;
}

/** `/works/OL123W` or `OL123W` → `OL123W`. */
function normaliseWorkKey(key: string): string {
  return key.replace(/^\/works\//, '');
}

/** Best-effort 4-digit year out of an OL date string like "1851" or "October 1851". */
function yearFrom(date: string | undefined): number | null {
  const match = date?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/**
 * Live Open Library client (docs/01 F6). Read-only HTTP against the public API; the
 * mapping logic here is covered by fixture-backed tests (no network). Import is a
 * low-volume admin action, so an author fan-out (N+1) is acceptable.
 */
export class FetchOpenLibraryClient implements OpenLibraryClient {
  constructor(private readonly baseUrl: string) {}

  async search(query: string, limit: number): Promise<OpenLibraryDoc[]> {
    const url = new URL('/search.json', this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i');
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as SearchResponse;
    return (body.docs ?? [])
      .filter((d) => d.key && d.title)
      .map((d) => ({
        workKey: normaliseWorkKey(d.key!),
        title: d.title!,
        authorNames: d.author_name ?? [],
        firstPublishYear: d.first_publish_year ?? null,
        coverId: d.cover_i ?? null,
      }));
  }

  async fetchWork(workKey: string): Promise<OpenLibraryWork | null> {
    const key = normaliseWorkKey(workKey);
    const res = await fetch(new URL(`/works/${key}.json`, this.baseUrl));
    if (!res.ok) return null;
    const work = (await res.json()) as WorkResponse;

    const description =
      typeof work.description === 'string'
        ? work.description
        : (work.description?.value ?? null);

    const authorKeys = (work.authors ?? [])
      .map((a) => a.author?.key)
      .filter((k): k is string => Boolean(k));
    const authorNames = (
      await Promise.all(authorKeys.map((k) => this.fetchAuthorName(k)))
    ).filter((n): n is string => Boolean(n));

    return {
      workKey: key,
      title: work.title ?? key,
      description,
      authorNames,
      firstPublishYear: yearFrom(work.first_publish_date),
      coverId: work.covers?.find((c) => c > 0) ?? null,
      subjects: work.subjects ?? [],
    };
  }

  private async fetchAuthorName(authorKey: string): Promise<string | null> {
    try {
      const res = await fetch(new URL(`${authorKey}.json`, this.baseUrl));
      if (!res.ok) return null;
      const body = (await res.json()) as AuthorResponse;
      return body.name ?? null;
    } catch {
      return null;
    }
  }
}
