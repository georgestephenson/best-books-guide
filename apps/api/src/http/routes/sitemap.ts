import { type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { SitemapSlugs } from '../../app/ports/catalogue-repository.js';
import type { GetSitemap } from '../../app/usecases/get-sitemap.js';

export interface SitemapRoutesDeps {
  getSitemap: GetSitemap;
  /** Absolute origin for <loc> URLs, e.g. https://bestbooks.guide (config.PUBLIC_BASE_URL). */
  publicBaseUrl: string;
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

function buildSitemap(base: string, slugs: SitemapSlugs): string {
  const urls = [
    `${base}/`,
    ...slugs.subjects.map((s) => `${base}/subjects/${s}`),
    ...slugs.lists.map((s) => `${base}/lists/${s}`),
    ...slugs.books.map((s) => `${base}/books/${s}`),
    ...slugs.series.map((s) => `${base}/series/${s}`),
  ];
  const body = urls.map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/**
 * `sitemap.xml` and `robots.txt` served by the API at the site root (docs/04) —
 * nginx proxies these two paths (they'd otherwise hit the SPA fallback). Mounted
 * without the /api/v1 prefix.
 */
export function sitemapRoutes(deps: SitemapRoutesDeps): FastifyPluginAsyncTypebox {
  const base = deps.publicBaseUrl.replace(/\/+$/, '');
  return async (app) => {
    app.get('/sitemap.xml', async (_request, reply) => {
      const slugs = await deps.getSitemap.execute();
      void reply.type('application/xml').send(buildSitemap(base, slugs));
    });

    app.get('/robots.txt', async (_request, reply) => {
      const body = `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
      void reply.type('text/plain').send(body);
    });
  };
}
