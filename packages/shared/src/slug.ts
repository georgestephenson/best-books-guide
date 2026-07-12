/**
 * Turn a title into a URL-safe slug: lowercase, ASCII, hyphen-separated.
 * Server-side source of truth for the `[a-z0-9-]` slugs in docs/03 & docs/05.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD') // split accented chars into base + diacritic
    .replace(/[̀-ͯ]/g, '') // strip the diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any run of non-alphanumerics becomes one hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}
