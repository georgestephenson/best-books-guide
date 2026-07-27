import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { sitemapRoutes } from './sitemap.js';
import { GetSitemap } from '../../app/usecases/get-sitemap.js';
import type { CatalogueRepository, SitemapSlugs } from '../../app/ports/catalogue-repository.js';

const emptySlugs: SitemapSlugs = { subjects: [], lists: [], books: [], series: [] };

/**
 * Only `sitemapSlugs` is exercised here; the rest of the read-side port is
 * irrelevant to these two routes, so the fake stays a one-method stub.
 */
function fakeCatalogue(slugs: SitemapSlugs): CatalogueRepository {
  return { sitemapSlugs: () => Promise.resolve(slugs) } as unknown as CatalogueRepository;
}

async function serve(
  slugs: SitemapSlugs,
  publicBaseUrl = 'https://bestbooks.guide',
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(
    sitemapRoutes({ getSitemap: new GetSitemap(fakeCatalogue(slugs)), publicBaseUrl }),
  );
  await app.ready();
  return app;
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /sitemap.xml', () => {
  it('serves XML with the site root even when the catalogue is empty', async () => {
    app = await serve(emptySlugs);
    const res = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.body).toContain('<url><loc>https://bestbooks.guide/</loc></url>');
  });

  it('emits one <loc> per slug across all four collections', async () => {
    app = await serve({
      subjects: ['history'],
      lists: ['best-history-books'],
      books: ['sapiens'],
      series: ['foundation'],
    });
    const res = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(res.body).toContain('<loc>https://bestbooks.guide/subjects/history</loc>');
    expect(res.body).toContain('<loc>https://bestbooks.guide/lists/best-history-books</loc>');
    expect(res.body).toContain('<loc>https://bestbooks.guide/books/sapiens</loc>');
    expect(res.body).toContain('<loc>https://bestbooks.guide/series/foundation</loc>');
    // root + one per collection
    expect(res.body.match(/<url>/g)).toHaveLength(5);
  });

  it('XML-escapes every reserved character in a slug', async () => {
    app = await serve({ ...emptySlugs, books: [`a<b>c&d'e"f`] });
    const res = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(res.body).toContain('a&lt;b&gt;c&amp;d&apos;e&quot;f');
    // the raw reserved characters must not survive into the document body
    expect(res.body).not.toContain(`a<b>`);
  });

  it('strips trailing slashes from the configured base URL', async () => {
    app = await serve({ ...emptySlugs, subjects: ['history'] }, 'https://bestbooks.guide///');
    const res = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(res.body).toContain('<loc>https://bestbooks.guide/</loc>');
    expect(res.body).toContain('<loc>https://bestbooks.guide/subjects/history</loc>');
    expect(res.body).not.toContain('guide//');
  });
});

describe('GET /robots.txt', () => {
  it('allows crawling, disallows /api/, and points at the sitemap', async () => {
    app = await serve(emptySlugs);
    const res = await app.inject({ method: 'GET', url: '/robots.txt' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toBe(
      'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://bestbooks.guide/sitemap.xml\n',
    );
  });
});
