/**
 * Stores cover images on the media volume (docs/02). The returned value is the
 * relative path recorded in `books.cover_path` and served at `/covers/<path>` by
 * nginx. Implementations must not throw the import flow off course — a cover is
 * nice-to-have, so a fetch/write failure returns null and the book imports coverless.
 */
export interface ImageStore {
  /**
   * Fetch `sourceUrl` and store it under a stable `key` (no extension). Returns the
   * relative path (e.g. `OL45804W.jpg`), or null if the image couldn't be fetched.
   */
  saveFromUrl(sourceUrl: string, key: string): Promise<string | null>;
}
